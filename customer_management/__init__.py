from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from pydantic import BaseModel
from typing import List, Optional, Annotated
import databutton as db
from datetime import datetime
import re
from app.auth import AuthorizedUser
from app.libs.admin_auth import get_current_admin
from app.libs.email_service import send_email

router = APIRouter()

def sanitize_storage_key(key: str) -> str:
    """Sanitize storage key to only allow alphanumeric and ._- symbols"""
    return re.sub(r'[^a-zA-Z0-9._-]', '', key)

def safe_get_json(key: str, default=None):
    """Safely get JSON from storage, handling FileNotFoundError"""
    try:
        return db.storage.json.get(key)
    except FileNotFoundError:
        return default

# Constants
ADMIN_EMAIL = "info@letterbox.es"

# Customer Models
class Customer(BaseModel):
    id: Optional[str] = None
    full_name: str
    address: str
    mailbox_number: str
    email: str
    telephone: Optional[str] = None
    location_id: Optional[str] = None  # Link to the physical location
    subscription_plan: str  # 'receive-only', 'receive-and-scan', 'receive-and-forward'
    status: Optional[str] = 'active'  # 'active', 'disabled', 'suspended'
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    firebase_uid: Optional[str] = None
    firebase_user_created: Optional[bool] = False
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    subscription_status: Optional[str] = None  # 'active', 'past_due', 'canceled', 'incomplete', etc.

class CreateCustomerRequest(BaseModel):
    full_name: str
    address: str
    mailbox_number: Optional[str] = None
    email: str
    telephone: Optional[str] = None
    location_id: Optional[str] = None
    subscription_plan: str
    status: Optional[str] = 'active'

class UpdateCustomerRequest(BaseModel):
    full_name: Optional[str] = None
    address: Optional[str] = None
    mailbox_number: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    location_id: Optional[str] = None
    subscription_plan: Optional[str] = None
    status: Optional[str] = None

class CustomerResponse(BaseModel):
    success: bool
    customer: Optional[Customer] = None
    message: str

class CustomersListResponse(BaseModel):
    success: bool
    customers: List[Customer]
    total_count: int

# Helper functions
def get_all_customers_key() -> str:
    """Storage key for all customers list"""
    return "all_customers"

def get_customer_by_email_key(email: str) -> str:
    """Storage key for customer lookup by email"""
    # Replace @ with _at_ to preserve email structure in storage key
    safe_email = email.replace('@', '_at_').replace('.', '_dot_')
    return sanitize_storage_key(f"customer_email_{safe_email}")

def get_customer_by_id_key(customer_id: str) -> str:
    """Storage key for customer lookup by ID"""
    return sanitize_storage_key(f"customer_id_{customer_id}")

def generate_customer_id(email: str) -> str:
    """Generate a unique customer ID"""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    return sanitize_storage_key(f"cust_{email}_{timestamp}")

def generate_mailbox_number(all_customers: List[dict]) -> str:
    """Generate the next mailbox number in sequence MBXXXX"""
    max_num = 0
    # Match MB followed by digits, e.g., MB001, MB0008
    pattern = re.compile(r'^MB(\d+)$')
    
    for customer in all_customers:
        mb_num = customer.get('mailbox_number', '')
        if not mb_num:
            continue
            
        match = pattern.match(mb_num)
        if match:
            try:
                num = int(match.group(1))
                # Skip abnormally large numbers if any (like dates or phone numbers masquerading as IDs)
                if num < 1000000: 
                    if num > max_num:
                        max_num = num
            except ValueError:
                continue
    
    next_num = max_num + 1
    # Ensure at least 4 digits, e.g., MB0008
    return f"MB{next_num:04d}"

# API Endpoints

@router.get("/customers", response_model=CustomersListResponse)
async def get_all_customers(admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Get all customers (admin only)"""
    try:
        customers = safe_get_json(get_all_customers_key(), default=[])
        
        # Sort by created_at (most recent first)
        customers.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return CustomersListResponse(
            success=True,
            customers=customers,
            total_count=len(customers)
        )
    except Exception as e:
        print(f"Error fetching customers: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch customers")

@router.post("/customers", response_model=CustomerResponse)
async def create_customer(request: CreateCustomerRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Create a new customer (admin only)"""
    try:
        # Check if customer with this email already exists
        all_customers = safe_get_json(get_all_customers_key(), default=[])
        existing_customer = next((c for c in all_customers if c['email'] == request.email), None)
        
        if existing_customer:
            raise HTTPException(status_code=400, detail="Customer with this email already exists")
        
        # Handle mailbox number
        mailbox_number = request.mailbox_number
        if not mailbox_number or mailbox_number.strip() == "":
            mailbox_number = generate_mailbox_number(all_customers)
        else:
            # Check if provided mailbox number is already taken
            existing_mailbox = next((c for c in all_customers if c['mailbox_number'] == mailbox_number), None)
            
            if existing_mailbox:
                raise HTTPException(status_code=400, detail="Mailbox number already assigned")
        
        # Generate customer ID
        customer_id = generate_customer_id(request.email)
        
        # Create Firebase user account first
        firebase_user_created = False
        firebase_user_uid = None
        temp_password = None
        
        try:
            # Import user management functions
            import requests
            from app.apis.user_management import generate_secure_password
            from firebase_admin import auth as firebase_auth
            
            # Initialize Firebase Admin SDK if not already done
            from app.apis.user_management import initialize_firebase_admin
            initialize_firebase_admin()
            
            # Generate secure password
            temp_password = generate_secure_password()
            
            # Create Firebase user
            user_record = firebase_auth.create_user(
                email=request.email,
                password=temp_password,
                display_name=request.full_name,
                email_verified=True  # Set as verified since admin is creating the account
            )
            
            firebase_user_created = True
            firebase_user_uid = user_record.uid
            
            print(f"Firebase user created for {request.email} with UID: {firebase_user_uid}")
            
            # Send welcome email with credentials
            try:
                welcome_content = f"""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #f59e0b;">Welcome to Letterbox.es!</h2>
                        
                        <p>Hello {request.full_name},</p>
                        
                        <p>Your digital mailbox account has been created. You can now access your mail online using the following credentials:</p>
                        
                        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p><strong>Email:</strong> {request.email}</p>
                            <p><strong>Temporary Password:</strong> <code style="background: #e5e5e5; padding: 2px 4px; border-radius: 3px;">{temp_password}</code></p>
                            <p><strong>Mailbox Number:</strong> {mailbox_number}</p>
                            <p><strong>Subscription Plan:</strong> {request.subscription_plan.replace('-', ' ').title()}</p>
                        </div>
                        
                        <p><strong>Important:</strong> Please change your password when you first log in for security.</p>
                        
                        <p>You can access your mailbox at: <a href="https://app.letterbox.es" style="color: #f59e0b;">https://app.letterbox.es</a></p>
                        
                        <p>If you have any questions, please contact our support team.</p>
                        
                        <p>Best regards,<br>The Letterbox.es Team</p>
                    </div>
                </body>
                </html>
                """
                
                # Send welcome email using Resend
                send_email(
                    to=request.email,
                    subject="Welcome to Letterbox.es - Your Account is Ready",
                    html=welcome_content,
                    text=f"Welcome to Letterbox.es! Your account has been created. Email: {request.email}, Temporary Password: {temp_password}. Please change your password when you first log in."
                )
                print(f"Welcome email sent to {request.email} via Resend")
                
            except Exception as email_error:
                print(f"Failed to send welcome email: {email_error}")
            
        except Exception as firebase_error:
            print(f"Failed to create Firebase user for {request.email}: {firebase_error}")
            # Continue with customer creation but note the Firebase user creation failed
        
        # Create customer object
        now = datetime.now().isoformat()
        customer = {
            'id': customer_id,
            'full_name': request.full_name,
            'address': request.address,
            'mailbox_number': mailbox_number,
            'email': request.email,
            'telephone': request.telephone,
            'location_id': request.location_id,
            'subscription_plan': request.subscription_plan,
            'status': request.status,
            'created_at': now,
            'updated_at': now,
            'firebase_uid': firebase_user_uid,
            'firebase_user_created': firebase_user_created
        }
        
        # Add to customers list
        all_customers.append(customer)
        db.storage.json.put(get_all_customers_key(), all_customers)
        
        # Create lookup entries
        db.storage.json.put(get_customer_by_email_key(request.email), customer)
        db.storage.json.put(get_customer_by_id_key(customer_id), customer)
        
        # Send admin notification
        try:
            admin_email_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #f59e0b;">New Customer Created - Letterbox.es</h2>
                    
                    <p>A new customer has been added to the system:</p>
                    
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Name:</strong> {request.full_name}</p>
                        <p><strong>Email:</strong> {request.email}</p>
                        <p><strong>Mailbox:</strong> {mailbox_number}</p>
                        <p><strong>Location ID:</strong> {request.location_id if request.location_id else 'Default'}</p>
                        <p><strong>Plan:</strong> {request.subscription_plan}</p>
                        <p><strong>Firebase User:</strong> {'✅ Created' if firebase_user_created else '❌ Failed to create'}</p>
                    </div>
                    
                    {f'<p><strong>Temporary Password:</strong> {temp_password}</p>' if temp_password else ''}
                    
                    <p>Customer ID: {customer_id}</p>
                    
                    <p>The Letterbox.es Admin System</p>
                </div>
            </body>
            </html>
            """
            
            # Send notification using Resend
            try:
                send_email(
                    to="info@letterbox.es",
                    subject=f"New Customer Created: {request.full_name}",
                    html=admin_email_content,
                    text=f"New customer created: {request.full_name} ({request.email}) - Mailbox: {mailbox_number}"
                )
                print(f"Sent admin notification via Resend for new customer: {request.full_name}")
            except Exception as email_error:
                print(f"Failed to send admin notification: {email_error}")
            
        except Exception as email_error:
            print(f"Failed to prepare admin notification: {email_error}")
        
        success_message = f"Customer {request.full_name} created successfully"
        if firebase_user_created:
            success_message += f" with Firebase account (credentials sent to {request.email})"
        else:
            success_message += " (Note: Firebase user account creation failed - please create manually)"
        
        return CustomerResponse(
            success=True,
            customer=customer,
            message=success_message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating customer: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create customer")

@router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str):
    """Get a specific customer by ID"""
    try:
        customer = safe_get_json(get_customer_by_id_key(customer_id), default=None)
        
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return CustomerResponse(
            success=True,
            customer=customer,
            message="Customer retrieved successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching customer: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch customer")

@router.put("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: str, request: UpdateCustomerRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Update a customer (admin only)"""
    try:
        # Get existing customer
        customer = safe_get_json(get_customer_by_id_key(customer_id), default=None)
        
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get all customers for validation
        all_customers = safe_get_json(get_all_customers_key(), default=[])
        
        # Update customer fields
        old_email = customer['email']
        updates = {}
        
        if request.full_name is not None:
            updates['full_name'] = request.full_name
        if request.address is not None:
            updates['address'] = request.address
        if request.mailbox_number is not None:
            if not request.mailbox_number.strip():
                # Auto-generate if empty
                updates['mailbox_number'] = generate_mailbox_number(all_customers)
            else:
                # Check if new mailbox number is already taken
                existing_mailbox = next(
                    (c for c in all_customers if c['mailbox_number'] == request.mailbox_number and c['id'] != customer_id), 
                    None
                )
                if existing_mailbox:
                    raise HTTPException(status_code=400, detail="Mailbox number already assigned")
                updates['mailbox_number'] = request.mailbox_number
        
        if request.email is not None:
            # Check if new email is already taken
            existing_email = next(
                (c for c in all_customers if c['email'] == request.email and c['id'] != customer_id), 
                None
            )
            if existing_email:
                raise HTTPException(status_code=400, detail="Customer with this email already exists")
            updates['email'] = request.email
        
        if request.telephone is not None:
            updates['telephone'] = request.telephone
        
        if request.location_id is not None:
            updates['location_id'] = request.location_id
            
        if request.subscription_plan is not None:
            updates['subscription_plan'] = request.subscription_plan
        
        if request.status is not None:
            updates['status'] = request.status
        
        # Apply updates
        customer.update(updates)
        customer['updated_at'] = datetime.now().isoformat()
        
        # Update in all customers list
        for i, c in enumerate(all_customers):
            if c['id'] == customer_id:
                all_customers[i] = customer
                break
        
        db.storage.json.put(get_all_customers_key(), all_customers)
        
        # Update lookup entries
        if request.email is not None and request.email != old_email:
            # Remove old email lookup
            try:
                db.storage.json.put(get_customer_by_email_key(old_email), None)
            except:
                pass
            # Add new email lookup
            db.storage.json.put(get_customer_by_email_key(request.email), customer)
        else:
            db.storage.json.put(get_customer_by_email_key(customer['email']), customer)
        
        db.storage.json.put(get_customer_by_id_key(customer_id), customer)
        
        return CustomerResponse(
            success=True,
            customer=customer,
            message="Customer updated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating customer: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update customer")

@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Delete a customer and all associated data (admin only)"""
    try:
        # Get existing customer
        customer = safe_get_json(get_customer_by_id_key(customer_id), default=None)
        
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        customer_email = customer['email']
        firebase_uid = customer.get('firebase_uid')
        deletion_results = []
        
        print(f"Starting deletion process for customer {customer_email} (ID: {customer_id})")
        
        # 1. Delete Firebase Auth account if it exists
        if firebase_uid:
            try:
                from firebase_admin import auth as firebase_auth
                from app.apis.user_management import initialize_firebase_admin
                
                # Initialize Firebase Admin SDK if not already done
                initialize_firebase_admin()
                
                # Delete the Firebase user
                firebase_auth.delete_user(firebase_uid)
                deletion_results.append(f"✅ Firebase Auth account deleted (UID: {firebase_uid})")
                print(f"Successfully deleted Firebase user with UID: {firebase_uid}")
                
            except Exception as firebase_error:
                error_msg = f"❌ Failed to delete Firebase Auth account: {str(firebase_error)}"
                deletion_results.append(error_msg)
                print(f"Firebase deletion error: {firebase_error}")
                # Continue with other deletions even if Firebase fails
        else:
            deletion_results.append("ℹ️ No Firebase UID found - skipping Firebase Auth deletion")
        
        # 2. Delete customer mail items
        try:
            # Get customer mail key
            customer_mail_key = sanitize_storage_key(f"customer_mail_{customer_email}")
            customer_mail = safe_get_json(customer_mail_key, default=[])
            
            if customer_mail:
                # Delete mail items
                db.storage.json.put(customer_mail_key, [])
                deletion_results.append(f"✅ Deleted {len(customer_mail)} mail items")
                print(f"Deleted {len(customer_mail)} mail items for {customer_email}")
            else:
                deletion_results.append("ℹ️ No mail items found")
                
        except Exception as mail_error:
            error_msg = f"❌ Failed to delete mail items: {str(mail_error)}"
            deletion_results.append(error_msg)
            print(f"Mail deletion error: {mail_error}")
            # Continue with other deletions
        
        # 3. Delete admin notifications related to this customer
        try:
            # Clean up any admin notifications for this customer
            notifications_key = "admin_notifications"
            notifications = safe_get_json(notifications_key, default=[])
            
            original_count = len(notifications)
            notifications = [n for n in notifications if n.get('customer_email') != customer_email]
            final_count = len(notifications)
            
            if original_count != final_count:
                db.storage.json.put(notifications_key, notifications)
                deleted_notifications = original_count - final_count
                deletion_results.append(f"✅ Deleted {deleted_notifications} admin notifications")
                print(f"Deleted {deleted_notifications} admin notifications for {customer_email}")
            else:
                deletion_results.append("ℹ️ No admin notifications found")
                
        except Exception as notif_error:
            error_msg = f"❌ Failed to delete admin notifications: {str(notif_error)}"
            deletion_results.append(error_msg)
            print(f"Notifications deletion error: {notif_error}")
            # Continue with other deletions
        
        # 4. Remove customer from all customers list
        try:
            all_customers = safe_get_json(get_all_customers_key(), default=[])
            all_customers = [c for c in all_customers if c['id'] != customer_id]
            db.storage.json.put(get_all_customers_key(), all_customers)
            deletion_results.append("✅ Removed from customers list")
            
        except Exception as customer_list_error:
            error_msg = f"❌ Failed to remove from customers list: {str(customer_list_error)}"
            deletion_results.append(error_msg)
            print(f"Customer list deletion error: {customer_list_error}")
        
        # 5. Remove customer lookup entries
        try:
            db.storage.json.put(get_customer_by_email_key(customer['email']), None)
            db.storage.json.put(get_customer_by_id_key(customer_id), None)
            deletion_results.append("✅ Removed lookup entries")
            
        except Exception as lookup_error:
            error_msg = f"❌ Failed to remove lookup entries: {str(lookup_error)}"
            deletion_results.append(error_msg)
            print(f"Lookup deletion error: {lookup_error}")
        
        # 6. Send admin notification about deletion
        try:
            deletion_summary = "\n".join(deletion_results)
            admin_email_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #dc2626;">Customer Account Deleted</h2>
                    
                    <p>A customer account has been deleted from the Letterbox.es system:</p>
                    
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Name:</strong> {customer['full_name']}</p>
                        <p><strong>Email:</strong> {customer_email}</p>
                        <p><strong>Mailbox:</strong> {customer['mailbox_number']}</p>
                        <p><strong>Customer ID:</strong> {customer_id}</p>
                    </div>
                    
                    <h3>Deletion Summary:</h3>
                    <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <pre style="font-family: monospace; font-size: 12px; white-space: pre-wrap;">{deletion_summary}</pre>
                    </div>
                    
                    <p style="color: #666; font-size: 12px;">This action was performed through the admin dashboard.</p>
                    
                    <p>The Letterbox.es Admin System</p>
                </div>
            </body>
            </html>
            """
            
            # Send notification using Resend
            try:
                send_email(
                    to="info@letterbox.es",
                    subject=f"Customer Account Deleted: {customer['full_name']}",
                    html=admin_email_content,
                    text=f"Customer account deleted: {customer['full_name']} ({customer_email}). Customer ID: {customer_id}. Deletion summary: {deletion_summary}"
                )
                print(f"Sent admin notification via Resend for deleted customer: {customer_email}")
            except Exception as email_error:
                print(f"Failed to send admin deletion notification: {email_error}")
            
        except Exception as email_error:
            print(f"Failed to prepare admin deletion notification: {email_error}")
        
        print(f"Customer deletion completed for {customer_email}. Results: {deletion_results}")
        
        return {
            "success": True, 
            "message": f"Customer {customer['full_name']} and all associated data deleted successfully",
            "deletion_summary": deletion_results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting customer: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete customer: {str(e)}")

@router.get("/customers/email/{email}", response_model=CustomerResponse)
async def get_customer_by_email(email: str):
    """Get a customer by email address"""
    try:
        # First try the new key format
        customer = safe_get_json(get_customer_by_email_key(email), default=None)
        
        # If not found, try the old key format and migrate
        if not customer:
            old_key = sanitize_storage_key(f"customer_email_{email}")
            customer = safe_get_json(old_key, default=None)
            
            if customer:
                # Migrate to new key format
                db.storage.json.put(get_customer_by_email_key(email), customer)
                # Clean up old key
                try:
                    db.storage.json.put(old_key, None)
                except:
                    pass
                print(f"Migrated customer {email} to new key format")
        
        if not customer:
            # print(f"Error fetching customer by email: {get_customer_by_email_key(email)} not found")
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return CustomerResponse(
            success=True,
            customer=customer,
            message="Customer retrieved successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching customer by email: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch customer")

class LinkCustomerRequest(BaseModel):
    email: str
    firebase_user_id: str

class LinkCustomerResponse(BaseModel):
    success: bool
    message: str
    customer_id: str

@router.post("/link-firebase-user", response_model=LinkCustomerResponse)
async def link_customer_to_firebase_user(request: LinkCustomerRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Link an existing customer record to a Firebase user ID"""
    try:
        # Get existing customer by email
        customer = safe_get_json(get_customer_by_email_key(request.email), default=None)
        
        if not customer:
            raise HTTPException(
                status_code=404,
                detail=f"Customer with email {request.email} not found"
            )
        
        # Update customer with Firebase user ID
        customer['firebase_uid'] = request.firebase_user_id
        customer['updated_at'] = datetime.now().isoformat()
        
        # Save updated customer
        db.storage.json.put(get_customer_by_id_key(customer['id']), customer)
        db.storage.json.put(get_customer_by_email_key(request.email), customer)
        
        # Update in all customers list
        all_customers = safe_get_json(get_all_customers_key(), default=[])
        for i, c in enumerate(all_customers):
            if c['id'] == customer['id']:
                all_customers[i] = customer
                break
        db.storage.json.put(get_all_customers_key(), all_customers)
        
        print(f"Successfully linked customer {request.email} to Firebase user {request.firebase_user_id}")
        
        return LinkCustomerResponse(
            success=True,
            message=f"Customer {request.email} successfully linked to Firebase user",
            customer_id=customer['id']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error linking customer to Firebase user: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to link customer to Firebase user"
        )

# File upload endpoint for envelope previews
@router.post("/upload-envelope")
async def upload_envelope_preview(file: UploadFile = File(...)):
    """Upload envelope preview image or PDF and return the URL"""
    try:
        # Validate file type - allow images and PDFs
        allowed_types = ['image/', 'application/pdf']
        if not file.content_type or not any(file.content_type.startswith(t) for t in allowed_types):
            raise HTTPException(status_code=400, detail="Only image files (JPEG, PNG) and PDF documents are allowed")
        
        # Validate file size - 10MB for PDFs, 5MB for images
        file_content = await file.read()
        max_size = 10 * 1024 * 1024 if file.content_type == 'application/pdf' else 5 * 1024 * 1024
        
        if len(file_content) > max_size:
            max_size_mb = "10MB" if file.content_type == 'application/pdf' else "5MB"
            raise HTTPException(status_code=400, detail=f"File size must be less than {max_size_mb}")
        
        # Generate unique filename with proper extension
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        file_extension = ".pdf" if file.content_type == 'application/pdf' else ".jpg"
        safe_filename = sanitize_storage_key(f"envelope_{timestamp}_{file.filename}") + file_extension
        
        # Store file in binary storage
        db.storage.binary.put(safe_filename, file_content)
        
        print(f"File uploaded successfully: {safe_filename} ({len(file_content)} bytes, type: {file.content_type})")
        
        # Return success with file key (can be used to retrieve later)
        return {
            "success": True,
            "file_key": safe_filename,
            "message": "File uploaded successfully",
            "original_filename": file.filename,
            "file_type": file.content_type,
            "file_size": len(file_content)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error uploading envelope preview: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload envelope preview")
