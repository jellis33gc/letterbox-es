from fastapi import APIRouter, HTTPException, Depends, Request, Header
from pydantic import BaseModel
from typing import Optional, Annotated
import stripe
import databutton as db
import os
import json
from app.integrations import get_integration_access_token
from app.auth import AuthorizedUser
from app.auth.user import get_authorized_user
from app.libs.admin_auth import get_current_admin
from app.env import Mode, mode
from datetime import datetime
import re
from app.libs.notification_service import create_admin_notification

# Initialize Stripe
try:
    stripe.api_key = get_integration_access_token(provider_key="stripe", integration_id="stripe")
except Exception:
    # Fallback to environment variable if integration is not connected
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

if not stripe.api_key:
    print("Warning: Stripe API key not found in Integrations or Environment variables.")

router = APIRouter()

# Configuration - These should be replaced with real Stripe Price IDs or fetched dynamically
# For now, we use placeholders. The user must create these products/prices in Stripe Dashboard.
SUBSCRIPTION_PLANS = {
    'receive-only': 'price_receive_only', 
    'receive-and-scan': 'price_receive_and_scan',
    'receive-and-forward': 'price_receive_and_forward'
}

PARCEL_PRODUCT_ID = 'prod_TzLdEMC4iSSx57'
PARCEL_PRICE_AMOUNT = 495  # 4.95 EUR in cents

# Helper functions
def sanitize_storage_key(key: str) -> str:
    return re.sub(r'[^a-zA-Z0-9._-]', '', key)

def get_customer_by_email_key(email: str) -> str:
    safe_email = email.replace('@', '_at_').replace('.', '_dot_')
    return sanitize_storage_key(f"customer_email_{safe_email}")

def get_customer_by_id_key(customer_id: str) -> str:
    return sanitize_storage_key(f"customer_id_{customer_id}")

def get_customer_record(email: str):
    """Get customer record from storage"""
    key = get_customer_by_email_key(email)
    try:
        customer = db.storage.json.get(key)
        return customer
    except FileNotFoundError:
        return None

def update_customer_record(customer):
    """Update customer record in storage"""
    # Update by ID
    if customer.get('id'):
        db.storage.json.put(get_customer_by_id_key(customer['id']), customer)
    
    # Update by Email
    if customer.get('email'):
        db.storage.json.put(get_customer_by_email_key(customer['email']), customer)
    
    # Update in all_customers list (this is inefficient but necessary given the current storage structure)
    try:
        all_customers = db.storage.json.get("all_customers", default=[])
        for i, c in enumerate(all_customers):
            if c.get('id') == customer.get('id') or c.get('email') == customer.get('email'):
                all_customers[i] = customer
                break
        else:
            # If not found, append (though it should be found)
            all_customers.append(customer)
        db.storage.json.put("all_customers", all_customers)
    except Exception as e:
        print(f"Error updating all_customers list: {e}")

# Models
class CheckoutSessionRequest(BaseModel):
    price_id: Optional[str] = None
    product_type: Optional[str] = 'subscription'  # 'subscription' or 'parcel'
    success_url: str
    cancel_url: str

class CheckoutSessionResponse(BaseModel):
    url: str

class PortalSessionRequest(BaseModel):
    return_url: str

class PortalSessionResponse(BaseModel):
    url: str

class VerifyParcelBookingRequest(BaseModel):
    session_id: str

class VerifyParcelBookingResponse(BaseModel):
    success: bool
    message: str
    mail_id: Optional[str] = None

# Endpoints

@router.post("/create-checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    request: CheckoutSessionRequest,
    user: Annotated[AuthorizedUser, Depends(get_authorized_user)]
):
    """Create a Stripe Checkout Session for a subscription or parcel delivery"""
    try:
        customer = get_customer_record(user.email)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        stripe_customer_id = customer.get('stripe_customer_id')
        
        # specific price ID provided or lookup from plan name? 
        # For simplicity, we assume the frontend sends the price ID directly, 
        # or sends the plan name which we map.
        price_id = request.price_id
        
        # Handle subscription logic
        if request.product_type == 'subscription':
            if price_id in SUBSCRIPTION_PLANS:
                price_id = SUBSCRIPTION_PLANS[price_id]
            
            mode = 'subscription'
            line_items = [{
                'price': price_id,
                'quantity': 1,
            }]
            metadata = {
                'customer_id': customer.get('id', ''),
                'plan_name': request.price_id if request.price_id in SUBSCRIPTION_PLANS else 'unknown',
                'type': 'subscription'
            }

        # Handle parcel delivery logic
        elif request.product_type == 'parcel':
            mode = 'payment'
            line_items = [{
                'price_data': {
                    'currency': 'eur',
                    'product': PARCEL_PRODUCT_ID,
                    'unit_amount': PARCEL_PRICE_AMOUNT,
                },
                'quantity': 1,
            }]
            metadata = {
                'customer_id': customer.get('id', ''),
                'type': 'parcel_booking'
            }
        
        else:
            raise HTTPException(status_code=400, detail="Invalid product type")

        if not stripe_customer_id:
            # Create a new Customer in Stripe
            try:
                stripe_customer = stripe.Customer.create(
                    email=user.email,
                    name=customer.get('full_name'),
                    metadata={
                        'customer_id': customer.get('id', ''),
                        'user_id': user.user_id
                    }
                )
                stripe_customer_id = stripe_customer.id
                
                # Update our records
                customer['stripe_customer_id'] = stripe_customer_id
                update_customer_record(customer)
            except Exception as e:
                print(f"Error creating Stripe customer: {e}")
                raise HTTPException(status_code=500, detail="Failed to create Stripe customer")

        # Create Checkout Session
        checkout_session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            line_items=line_items,
            mode=mode,
            success_url=f"{request.success_url}&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=request.cancel_url,
            metadata=metadata,
            allow_promotion_codes=True,
        )
        
        return CheckoutSessionResponse(url=checkout_session.url)
        
    except stripe.error.StripeError as e:
        print(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/create-portal-session", response_model=PortalSessionResponse)
async def create_portal_session(
    request: PortalSessionRequest,
    user: Annotated[AuthorizedUser, Depends(get_authorized_user)]
):
    """Create a Stripe Customer Portal Session"""
    try:
        customer = get_customer_record(user.email)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
            
        stripe_customer_id = customer.get('stripe_customer_id')
        
        if not stripe_customer_id:
            raise HTTPException(status_code=400, detail="No billing account found for this user")
            
        session = stripe.billing_portal.Session.create(
            customer=stripe_customer_id,
            return_url=request.return_url,
        )
        
        return PortalSessionResponse(url=session.url)
        
    except stripe.error.StripeError as e:
        print(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error creating portal session: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/verify-parcel-booking", response_model=VerifyParcelBookingResponse)
async def verify_parcel_booking(
    request: VerifyParcelBookingRequest,
    user: Annotated[AuthorizedUser, Depends(get_authorized_user)]
):
    """Verify Stripe checkout session and create parcel if missing"""
    try:
        if not stripe.api_key:
             raise HTTPException(status_code=500, detail="Stripe API key not configured")

        session = stripe.checkout.Session.retrieve(request.session_id)
        
        if session.payment_status != 'paid':
             return VerifyParcelBookingResponse(success=False, message="Payment not completed")
             
        # Extract customer email
        customer_email = None
        if session.get('customer_details') and session['customer_details'].get('email'):
            customer_email = session['customer_details']['email']
            
        if not customer_email:
             return VerifyParcelBookingResponse(success=False, message="Could not identify customer")
             
        # Check if parcel booking
        if session.get('metadata', {}).get('type') != 'parcel_booking':
             return VerifyParcelBookingResponse(success=False, message="Not a parcel booking session")

        # Create parcel item (idempotent)
        mail_id = create_parcel_mail_item(customer_email, session_id=request.session_id)
        
        return VerifyParcelBookingResponse(
            success=True, 
            message="Parcel booking verified",
            mail_id=mail_id
        )
        
    except stripe.error.StripeError as e:
        print(f"Stripe error verifying session: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error verifying parcel booking: {e}")
        raise HTTPException(status_code=500, detail="Verification failed")

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe Webhooks"""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
    
    event = None

    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
        else:
            if mode == Mode.PROD:
                 # In production, we MUST verify the signature
                 print("Error: Webhook signature verification failed (STRIPE_WEBHOOK_SECRET not set in production)")
                 raise HTTPException(status_code=500, detail="Webhook configuration error")

            # If no secret is set (dev mode), verify manually or skip signature check
            # WARNING: This is insecure for production.
            data = json.loads(payload)
            event = stripe.Event.construct_from(data, stripe.api_key)
            print("Warning: Webhook signature verification skipped (STRIPE_WEBHOOK_SECRET not set)")
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        handle_checkout_session_completed(session)
    elif event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        handle_subscription_updated(subscription)
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        handle_subscription_deleted(subscription)
    
    return {"status": "success"}

def handle_checkout_session_completed(session):
    """Handle successful checkout"""
    print(f"Processing checkout session: {session.get('id')}")
    
    stripe_customer_id = session.get('customer')
    subscription_id = session.get('subscription')
    metadata = session.get('metadata', {})
    
    print(f"Session Metadata: {metadata}")
    print(f"Session Customer Details: {session.get('customer_details')}")
    
    # Try to find customer by Stripe ID, or fallback to email lookup
    # Since we can't search by stripe_id efficiently without an index, we rely on metadata or email
    customer_email = None
    if session.get('customer_details') and session['customer_details'].get('email'):
        customer_email = session['customer_details']['email']
    
    if not customer_email:
        print(f"Could not identify customer for session {session.get('id')}")
        return

    print(f"Identified customer email: {customer_email}")

    # Handle Subscription
    if metadata.get('type') == 'subscription' or metadata.get('plan_name'):
        customer = get_customer_record(customer_email)
        if customer:
            customer['stripe_customer_id'] = stripe_customer_id
            customer['stripe_subscription_id'] = subscription_id
            customer['subscription_status'] = 'active'
            
            # If we passed plan_name in metadata, update the plan
            plan_name = metadata.get('plan_name')
            if plan_name and plan_name in SUBSCRIPTION_PLANS:
                 customer['subscription_plan'] = plan_name
                 
            update_customer_record(customer)
            print(f"Updated customer {customer_email} with subscription {subscription_id}")

    # Handle Parcel Booking
    elif metadata.get('type') == 'parcel_booking':
        print(f"Processing parcel booking for {customer_email}")
        create_parcel_mail_item(customer_email, session_id=session.get('id'))

def create_parcel_mail_item(customer_email: str, session_id: str = None):
    """Create a new mail item for a parcel booking"""
    try:
        # Get existing customer mail
        customer_mail_key = sanitize_storage_key(f"customer_mail_{customer_email}")
        mail_items = db.storage.json.get(customer_mail_key, default=[])

        # Check for existing item with this session_id (deduplication)
        if session_id:
            for item in mail_items:
                if item.get('stripe_session_id') == session_id:
                    print(f"Parcel mail item already exists for session {session_id}")
                    return item['id']

        # Generate mail item ID
        mail_id = sanitize_storage_key(f"parcel_{customer_email}_{datetime.now().strftime('%Y%m%d%H%M%S')}")
        
        # Create mail item
        mail_item = {
            'id': mail_id,
            'customer_email': customer_email,
            'sender': 'Parcel Delivery Service',
            'date': datetime.now().strftime('%Y-%m-%d'),
            'status': 'expecting',
            'priority': 'normal',
            'type': 'parcel',
            'envelope_preview_url': '', # No preview yet
            'subscription_plan': 'n/a', # Not tied to subscription
            'actions': [],
            'tracking_number': '', # To be filled by customer
            'created_at': datetime.now().isoformat(),
            'stripe_session_id': session_id
        }
        
        # Add new mail item
        mail_items.append(mail_item)
        
        # Save updated mail items
        db.storage.json.put(customer_mail_key, mail_items)
        print(f"Parcel mail item created for {customer_email}")
        
        # Create admin notification for new parcel booking
        create_admin_notification(mail_item, "parcel_booking", customer_email)
        
        return mail_id
        
    except Exception as e:
        print(f"Error creating parcel mail item: {str(e)}")
        return None

def handle_subscription_updated(subscription):
    """Handle subscription updates"""
    stripe_customer_id = subscription.get('customer')
    status = subscription.get('status')
    
    # We need to find the customer. This is tricky without an index on stripe_customer_id.
    # We'll have to scan all customers or rely on the fact that we should have stored the ID.
    # For now, we'll scan all customers.
    try:
        all_customers = db.storage.json.get("all_customers", default=[])
        customer = next((c for c in all_customers if c.get('stripe_customer_id') == stripe_customer_id), None)
        
        if customer:
            customer['subscription_status'] = status
            # If status is not active, we might want to update subscription_plan or handle logic
            update_customer_record(customer)
            print(f"Updated subscription status for {customer['email']} to {status}")
    except Exception as e:
        print(f"Error handling subscription update: {e}")

def handle_subscription_deleted(subscription):
    """Handle subscription cancellation"""
    stripe_customer_id = subscription.get('customer')
    
    try:
        all_customers = db.storage.json.get("all_customers", default=[])
        customer = next((c for c in all_customers if c.get('stripe_customer_id') == stripe_customer_id), None)
        
        if customer:
            customer['subscription_status'] = 'canceled'
            customer['stripe_subscription_id'] = None
            # Maybe revert to a default plan?
            # customer['subscription_plan'] = 'receive-only' 
            update_customer_record(customer)
            print(f"Subscription canceled for {customer['email']}")
    except Exception as e:
        print(f"Error handling subscription deletion: {e}")

class SyncStripeCustomersResponse(BaseModel):
    success: bool
    message: str
    matches_found: int
    updated_count: int

@router.post("/sync-stripe-customers", response_model=SyncStripeCustomersResponse)
async def sync_stripe_customers(
    admin: Annotated[AuthorizedUser, Depends(get_current_admin)]
):
    """Sync all customers with Stripe to update IDs and subscription status"""
    # Check if user is admin (you might want a better check, but for now we trust the authorized user is accessing this via admin dashboard which has its own guards)
    # The frontend AdminGuard protects the UI, but we should double check here if we had roles.
    # Assuming any authorized user hitting this endpoint is valid for now, or you can add `get_current_admin` dependency if available.
    
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe API key not configured")

    try:
        all_customers = db.storage.json.get("all_customers", default=[])
        matches_found = 0
        updated_count = 0
        
        for customer in all_customers:
            email = customer.get("email")
            if not email:
                continue
                
            try:
                if email:
                    stripe_customers = stripe.Customer.list(email=email).data
                    
                    if not stripe_customers:
                        continue
                        
                    # Find the most relevant stripe customer if there are multiple
                    # Prefer one with an active subscription, then one with any subscription, then fallback to first
                    stripe_customer = None
                    best_subscriptions = []
                    best_trial_subscriptions = []
                    best_schedules = []
                    
                    for sc in stripe_customers:
                        subs = stripe.Subscription.list(customer=sc.id, status='active', limit=1).data
                        if subs:
                            stripe_customer = sc
                            best_subscriptions = subs
                            break
                            
                        trial_subs = stripe.Subscription.list(customer=sc.id, status='trialing', limit=1).data
                        if trial_subs and not stripe_customer:
                            stripe_customer = sc
                            best_trial_subscriptions = trial_subs
                            
                        all_scheds = stripe.SubscriptionSchedule.list(customer=sc.id, limit=5).data
                        scheds = [s for s in all_scheds if s.status == 'not_started']
                        
                        if scheds and not stripe_customer and not best_trial_subscriptions:
                            stripe_customer = sc
                            best_schedules = scheds
                            
                    if not stripe_customer:
                        stripe_customer = stripe_customers[0]
                        
                    matches_found += 1
                    
                    update_needed = False
                    if customer.get('stripe_customer_id') != stripe_customer.id:
                        customer['stripe_customer_id'] = stripe_customer.id
                        update_needed = True
                    
                    if best_subscriptions:
                        active_sub = best_subscriptions[0]
                        if customer.get('stripe_subscription_id') != active_sub.id or customer.get('subscription_status') != 'active':
                            customer['stripe_subscription_id'] = active_sub.id
                            customer['subscription_status'] = 'active'
                            
                            # Update plan if possible
                            if active_sub.items and active_sub.items.data:
                                price_id = active_sub.items.data[0].price.id
                                plan_name = next((name for name, pid in SUBSCRIPTION_PLANS.items() if pid == price_id), None)
                                if plan_name:
                                    customer['subscription_plan'] = plan_name
                            
                            update_needed = True
                    elif best_trial_subscriptions:
                        trial_sub = best_trial_subscriptions[0]
                        if customer.get('stripe_subscription_id') != trial_sub.id or customer.get('subscription_status') != 'active':
                            customer['stripe_subscription_id'] = trial_sub.id
                            customer['subscription_status'] = 'active'
                            update_needed = True
                    elif best_schedules:
                        sched = best_schedules[0]
                        if customer.get('stripe_subscription_id') != sched.id or customer.get('subscription_status') != 'scheduled':
                            customer['stripe_subscription_id'] = sched.id  # Store schedule ID for reference
                            customer['subscription_status'] = 'scheduled'
                            
                            # Try to guess plan
                            if sched.phases and sched.phases[0].items:
                                price_id = sched.phases[0].items[0].price
                                plan_name = next((name for name, pid in SUBSCRIPTION_PLANS.items() if pid == price_id), None)
                                if plan_name:
                                    customer['subscription_plan'] = plan_name
                                    
                            update_needed = True
                    else:
                        # Fallback for updating an existing active customer that became inactive
                        if customer.get('subscription_status') == 'active' or customer.get('subscription_status') == 'scheduled':
                            customer['subscription_status'] = 'inactive'
                            customer['stripe_subscription_id'] = None
                            update_needed = True
                            
                    if update_needed:
                        update_customer_record(customer)
                        updated_count += 1
                        
            except Exception as e:
                print(f"Error syncing customer {email}: {e}")
                continue

        return SyncStripeCustomersResponse(
            success=True,
            message=f"Synced {updated_count} customers",
            matches_found=matches_found,
            updated_count=updated_count
        )

    except Exception as e:
        print(f"Error executing sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))
