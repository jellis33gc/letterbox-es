from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Annotated
from datetime import datetime
import databutton as db
from app.auth import AuthorizedUser
from app.libs.admin_auth import get_current_admin
import uuid
import re
from app.libs.email_service import send_email
from app.libs.notification_service import create_admin_notification

# Constants
ADMIN_EMAIL = "info@letterbox.es"

router = APIRouter(prefix="/mail")

# Request/Response Models
class MailActionRequest(BaseModel):
    mail_id: str
    action: str  # 'hold', 'recycle', 'shred', 'scan', 'forward', 'add_tracking'
    notes: Optional[str] = None
    sender: Optional[str] = None

class MailActionResponse(BaseModel):
    success: bool
    message: str
    mail_id: str
    new_status: str

class MailItem(BaseModel):
    id: str
    customer_email: str
    sender: str
    date: str
    status: str  # 'new', 'pending', 'processed', 'expecting'
    priority: str  # 'normal', 'urgent'
    envelope_preview_url: str
    subscription_plan: str  # 'receive-only', 'receive-and-scan', 'receive-and-forward', 'n/a'
    actions: List[dict] = []
    tracking_number: Optional[str] = None
    type: Optional[str] = 'letter'  # 'letter' or 'parcel'

class CustomerMailResponse(BaseModel):
    mail_items: List[MailItem]
    total_count: int

class CreateMailItemRequest(BaseModel):
    customer_email: str
    sender: str
    priority: str = 'normal'
    envelope_file_key: Optional[str] = None  # File key from upload
    subscription_plan: str

class CreateMailItemResponse(BaseModel):
    success: bool
    mail_id: str
    message: str

class MarkAsReadRequest(BaseModel):
    mail_id: str

class MarkAsReadResponse(BaseModel):
    success: bool
    message: str
    mail_id: str

class CompleteNotificationRequest(BaseModel):
    notification_id: str

class CompleteNotificationResponse(BaseModel):
    success: bool
    message: str

class AdminCompleteActionRequest(BaseModel):
    notification_id: str
    customer_email: str
    mail_id: str
    action: str
    admin_notes: str = ""
    scanned_file_key: str | None = None

class AdminCompleteActionResponse(BaseModel):
    success: bool
    message: str
    customer_notified: bool

class AdminUpdateParcelStatusRequest(BaseModel):
    mail_id: str
    customer_email: str
    status: str  # 'received', 'collected'
    notification_id: Optional[str] = None

class AdminUpdateParcelDetailsRequest(BaseModel):
    mail_id: str
    customer_email: str
    tracking_number: str
    sender: str

class AdminSendParcelReminderRequest(BaseModel):
    mail_id: str
    customer_email: str

class MarkNotificationReadRequest(BaseModel):
    notification_id: str

class GenericResponse(BaseModel):
    success: bool
    message: str

class ActivityLogEntry(BaseModel):
    id: str
    timestamp: str
    customer_email: str
    customer_name: Optional[str] = None
    action_type: str
    performed_by: str  # 'customer' or 'admin'
    details: str
    mail_id: str
    mail_sender: str

class ActivityLogResponse(BaseModel):
    logs: List[ActivityLogEntry]
    count: int

class MailItemAudit(MailItem):
    customer_name: Optional[str] = None
    customer_email: str

class MailItemAuditResponse(BaseModel):
    items: List[MailItemAudit]
    count: int

class AdminNotification(BaseModel):
    id: str
    timestamp: str
    type: str
    customer_email: str
    mail_id: Optional[str] = None
    sender: Optional[str] = None
    status: str = "pending"
    read: bool = False
    details: dict

class AdminNotificationResponse(BaseModel):
    notifications: List[AdminNotification]
    count: int


# Helper Functions
def sanitize_storage_key(key: str) -> str:
    """Sanitize storage key to only allow alphanumeric and ._- symbols"""
    return re.sub(r'[^a-zA-Z0-9._-]', '', key)

def get_customer_mail_key(customer_email: str) -> str:
    """Generate storage key for customer mail data"""
    return sanitize_storage_key(f"customer_mail_{customer_email}")

def send_customer_notification(customer_email: str, mail_item: dict, action: str = None):
    """Send email notification to customer"""
    try:
        if action:
            subject = f"Letterbox.es - Mail Action Processed: {action.title()}"
            content_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="background-color: #f9f9f9; padding: 20px;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #eab308; margin: 0;">Letterbox.es</h1>
                        </div>
                        
                        <h2 style="color: #333; margin-bottom: 20px;">Mail Action Processed</h2>
                        
                        <p>Hello,</p>
                        
                        <p>We have processed your request for the mail from <strong>{mail_item.get('sender', 'Unknown Sender')}</strong> received on {mail_item.get('date', 'Unknown Date')}.</p>
                        
                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0;"><strong>Action:</strong> {action.title()}</p>
                            <p style="margin: 5px 0 0 0;"><strong>Status:</strong> Processing</p>
                        </div>
                        
                        <p>You will receive another notification once the action has been completed.</p>
                        
                        <p>Best regards,<br>The Letterbox.es Team</p>
                        
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #666; text-align: center;">This is an automated message from Letterbox.es</p>
                    </div>
                </div>
            </body>
            </html>
            """
        else:
            subject = f"Letterbox.es - New Mail Received from {mail_item.get('sender', 'Unknown Sender')}"
            content_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="background-color: #f9f9f9; padding: 20px;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #eab308; margin: 0;">Letterbox.es</h1>
                        </div>
                        
                        <h2 style="color: #333; margin-bottom: 20px;">New Mail Received</h2>
                        
                        <p>Hello,</p>
                        
                        <p>You have received new mail in your Letterbox.es digital mailbox.</p>
                        
                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0;"><strong>From:</strong> {mail_item.get('sender', 'Unknown Sender')}</p>
                            <p style="margin: 5px 0 0 0;"><strong>Received:</strong> {mail_item.get('date', 'Unknown Date')}</p>
                            <p style="margin: 5px 0 0 0;"><strong>Priority:</strong> {mail_item.get('priority', 'Normal').title()}</p>
                        </div>
                        
                        <p>Please log in to your account to view the envelope scan and choose your preferred action.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="#" style="background-color: #eab308; color: black; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Your Mailbox</a>
                        </div>
                        
                        <p>Best regards,<br>The Letterbox.es Team</p>
                        
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #666; text-align: center;">This is an automated message from Letterbox.es</p>
                    </div>
                </div>
            </body>
            </html>
            """
        
        # Send notification using Resend
        send_email(
            to=customer_email,
            subject=f"Letterbox.es - Action Confirmed: {action.title()}" if action else subject,
            html=content_html,
            text=f"Your request to {action} mail from {mail_item.get('sender', 'Unknown Sender')} has been confirmed." if action else f"You have received new mail from {mail_item.get('sender', 'Unknown Sender')}."
        )
        print(f"Sent confirmation email to {customer_email} for action {action}")
    except Exception as e:
        print(f"Failed to send customer notification: {str(e)}")

def send_admin_notification(mail_item: dict, action: str, customer_email: str):
    """Send email notification to admin team"""
    try:
        admin_email = "info@letterbox.es"
        subject = f"Letterbox.es - Customer Action Required: {action.title()}"
        content_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="background-color: #f9f9f9; padding: 20px;">
                <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #eab308; margin: 0;">Letterbox.es Admin</h1>
                    </div>
                    
                    <h2 style="color: #333; margin-bottom: 20px;">Customer Action Required</h2>
                    
                    <p>A customer has requested an action on their mail item.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Customer:</strong> {customer_email}</p>
                        <p style="margin: 5px 0 0 0;"><strong>Mail From:</strong> {mail_item.get('sender', 'Unknown Sender')}</p>
                        <p style="margin: 5px 0 0 0;"><strong>Received:</strong> {mail_item.get('date', 'Unknown Date')}</p>
                        <p style="margin: 5px 0 0 0;"><strong>Action Requested:</strong> {action.title()}</p>
                        <p style="margin: 5px 0 0 0;"><strong>Mail ID:</strong> {mail_item.get('id', 'Unknown ID')}</p>
                    </div>
                    
                    <p>Please process this request and update the customer accordingly.</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="#" style="background-color: #eab308; color: black; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Admin Dashboard</a>
                    </div>
                    
                    <p>Best regards,<br>Letterbox.es System</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Send notification using Resend
        send_email(
            to=admin_email,
            subject=subject,
            html=content_html,
            text=f"Customer {customer_email} has requested to {action} mail from {mail_item.get('sender', 'Unknown Sender')}."
        )
        print(f"Sent admin notification to {admin_email} for customer action {action}")
    except Exception as e:
        print(f"Failed to send admin notification: {str(e)}")

def send_customer_action_completion_notification(customer_email: str, mail_item: dict, action: str, admin_notes: str, scanned_file_key: str | None = None):
    """Send email notification to customer about action completion"""
    try:
        subject = f"Letterbox.es - Your mail action has been completed: {action.title()}"
        
        # Build action description
        action_descriptions = {
            'scan': 'opened and scanned',
            'forward': 'forwarded to your address',
            'hold': 'placed on hold',
            'recycle': 'recycled',
            'shred': 'securely shredded'
        }
        
        action_description = action_descriptions.get(action, action)
        file_attachment_text = ""
        
        if scanned_file_key and action == 'scan':
            file_attachment_text = "<p style='background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0;'><strong>📄 Scanned Document Available:</strong> Your document has been scanned and is now available in your inbox.</p>"
        
        content_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="background-color: #f9f9f9; padding: 20px;">
                <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #eab308; margin: 0;">Letterbox.es</h1>
                    </div>
                    
                    <h2 style="color: #333; margin-bottom: 20px;">✅ Action Completed</h2>
                    
                    <p>Good news! We've completed the action you requested on your mail item.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Mail From:</strong> {mail_item.get('sender', 'Unknown Sender')}</p>
                        <p style="margin: 5px 0 0 0;"><strong>Received:</strong> {mail_item.get('date', 'Unknown Date')}</p>
                        <p style="margin: 5px 0 0 0;"><strong>Action Completed:</strong> {action_description.title()}</p>
                    </div>
                    
                    {file_attachment_text}
                    
                    {f'<p><strong>Notes from our team:</strong><br>{admin_notes}</p>' if admin_notes else ''}
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="#" style="background-color: #eab308; color: black; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Your Inbox</a>
                    </div>
                    
                    <p>Thank you for using Letterbox.es!</p>
                    
                    <p>Best regards,<br>The Letterbox.es Team</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        content_text = f"""Your Letterbox.es mail action has been completed!
        
Mail From: {mail_item.get('sender', 'Unknown Sender')}
Received: {mail_item.get('date', 'Unknown Date')}
Action Completed: {action_description.title()}
        
{f'Notes from our team: {admin_notes}' if admin_notes else ''}
        
{f'Your document has been scanned and is now available in your inbox.' if scanned_file_key and action == 'scan' else ''}
        
Thank you for using Letterbox.es!
        
The Letterbox.es Team
        """
        
        # Send notification using Resend
        send_email(
            to=customer_email,
            subject=subject,
            html=content_html,
            text=content_text
        )
        print(f"Sent customer action completion notification via Resend to {customer_email}")
        
    except Exception as e:
        print(f"Failed to send customer action completion notification: {str(e)}")

# API Endpoints

@router.post("/actions/process", response_model=MailActionResponse)
async def process_mail_action(request: MailActionRequest, user: AuthorizedUser):
    """Process a customer mail action (hold, recycle, shred, scan, forward, add_tracking)"""
    try:
        print(f"DEBUG: Processing action for user email: {user.email}")
        
        # Get user email - first try direct email, then lookup by Firebase UID
        user_email = user.email
        if not user_email:
            if '@' in user.sub:
                user_email = user.sub
            else:
                try:
                    customers = db.storage.json.list()
                    customer_files = [f for f in customers if f.name.startswith('customer_id_') or f.name.startswith('customer_email_')]
                    
                    for f in customer_files:
                        try:
                            customer_data = db.storage.json.get(f.name)
                            if customer_data and customer_data.get('firebase_uid') == user.sub:
                                user_email = customer_data.get('email')
                                break
                        except Exception:
                            continue
                            
                    if not user_email:
                        print(f"DEBUG: Could not find customer for UID: {user.sub}")
                except Exception as e:
                    print(f"DEBUG: Error looking up customer by UID: {e}")
                    user_email = "test@letterbox.es"
        
        # Get customer mail data
        customer_mail_key = get_customer_mail_key(user_email)
        mail_items = db.storage.json.get(customer_mail_key, default=[])
        
        # Find the mail item
        mail_item = None
        for i, item in enumerate(mail_items):
            if item.get('id') == request.mail_id:
                mail_item = item
                break
        
        if not mail_item:
            raise HTTPException(status_code=404, detail="Mail item not found")
        
        # Handle tracking number update for parcels
        if request.action == 'add_tracking':
            if mail_item.get('type') != 'parcel':
                raise HTTPException(status_code=400, detail="Tracking number can only be added to parcels")
            
            mail_item['tracking_number'] = request.notes
            
            # Update sender if provided
            if request.sender:
                mail_item['sender'] = request.sender
            
            # We don't change status, it remains 'expecting' until received
            
            # Save and return early as this doesn't need admin notification flow
            mail_items[i] = mail_item
            db.storage.json.put(customer_mail_key, mail_items)
            
            return MailActionResponse(
                success=True,
                message="Tracking number updated successfully",
                mail_id=request.mail_id,
                new_status=mail_item['status']
            )

        # Get customer subscription plan from customer data
        customer_key = sanitize_storage_key(f"customer_email_{user_email}")
        customer_data = db.storage.json.get(customer_key, default={})
        customer_subscription = customer_data.get('subscription_plan', 'receive-only')
        
        # Use customer subscription plan, not individual mail item plan
        subscription_plan = customer_subscription
        
        valid_actions = {
            'receive-only': ['hold', 'recycle', 'shred'],
            'receive-and-scan': ['scan', 'hold', 'recycle', 'shred'],
            'receive-and-forward': ['forward', 'recycle', 'shred'],
            'basic': ['hold', 'recycle', 'shred']  # Handle basic plan as receive-only
        }
        
        if request.action not in valid_actions.get(subscription_plan, []):
            raise HTTPException(
                status_code=400, 
                detail=f"Action '{request.action}' not available for subscription plan '{subscription_plan}'"
            )
        
        # Update mail item status
        mail_item['status'] = 'pending'
        
        # Add action to mail item history
        if 'actions' not in mail_item:
            mail_item['actions'] = []
        
        mail_item['actions'].append({
            'id': sanitize_storage_key(f"action_{request.mail_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"),
            'type': request.action,
            'timestamp': datetime.now().isoformat(),
            'notes': request.notes,
            'status': 'pending'
        })
        
        # Save updated mail items
        mail_items[i] = mail_item
        db.storage.json.put(customer_mail_key, mail_items)
        
        # Send notifications
        send_customer_notification(user_email, mail_item, request.action)
        send_admin_notification(mail_item, request.action, user_email)
        
        # Add notification for admin
        try:
            details = {"action": request.action}
            if request.notes:
                details["notes"] = request.notes
            
            create_admin_notification(mail_item, request.action, user_email, details=details)
        except Exception as e:
            print(f"Error creating notification: {e}")

        return MailActionResponse(
            success=True,
            message=f"Action '{request.action}' requested successfully",
            mail_id=request.mail_id,
            new_status='pending'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing mail action: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process mail action")

@router.get("/customer/items", response_model=CustomerMailResponse)
async def get_customer_mail(user: AuthorizedUser):
    """Get all mail items for the authenticated customer"""
    try:
        user_email = user.email
        if not user_email:
            try:
                customers = db.storage.json.list()
                customer_files = [f for f in customers if f.name.startswith('customer_id_')]
                
                for f in customer_files:
                    try:
                        customer_data = db.storage.json.get(f.name)
                        if customer_data and customer_data.get('firebase_uid') == user.sub:
                            user_email = customer_data.get('email')
                            break
                    except Exception:
                        continue
            except Exception:
                user_email = "test@letterbox.es"
                
        customer_mail_key = get_customer_mail_key(user_email)
        mail_items = db.storage.json.get(customer_mail_key, default=[])
        
        # Sort by date (most recent first)
        mail_items.sort(key=lambda x: x.get('date', ''), reverse=True)
        
        return CustomerMailResponse(
            mail_items=mail_items,
            total_count=len(mail_items)
        )
        
    except Exception as e:
        print(f"Error fetching customer mail: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch mail items")

@router.post("/admin/create", response_model=CreateMailItemResponse)
async def create_mail_item(request: CreateMailItemRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Create a new mail item for a customer (admin endpoint)"""
    try:
        # Generate mail item ID
        mail_id = sanitize_storage_key(f"mail_{request.customer_email}_{datetime.now().strftime('%Y%m%d%H%M%S')}")
        
        # Create mail item
        mail_item = {
            'id': mail_id,
            'customer_email': request.customer_email,
            'sender': request.sender,
            'date': datetime.now().strftime('%Y-%m-%d'),
            'status': 'new',
            'priority': request.priority,
            'envelope_preview_url': f"/api/envelope/{request.envelope_file_key}" if request.envelope_file_key else '',
            'envelope_file_key': request.envelope_file_key,
            'subscription_plan': request.subscription_plan,
            'actions': [],
            'created_at': datetime.now().isoformat()
        }
        
        # Get existing customer mail
        customer_mail_key = get_customer_mail_key(request.customer_email)
        mail_items = db.storage.json.get(customer_mail_key, default=[])
        
        # Add new mail item
        mail_items.append(mail_item)
        
        # Save updated mail items
        db.storage.json.put(customer_mail_key, mail_items)
        
        # Send notification to customer about new mail
        send_customer_notification(request.customer_email, mail_item)
        
        return CreateMailItemResponse(
            success=True,
            mail_id=mail_id,
            message=f"Mail item created successfully for {request.customer_email}"
        )
        
    except Exception as e:
        print(f"Error creating mail item: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create mail item")

@router.get("/admin/customer/{customer_email}/items", response_model=CustomerMailResponse)
async def get_customer_mail_for_admin(customer_email: str, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Get all mail items for a specific customer (admin only)"""
    try:
        customer_mail_key = get_customer_mail_key(customer_email)
        mail_items = db.storage.json.get(customer_mail_key, default=[])
        
        # Sort by date (most recent first)
        mail_items.sort(key=lambda x: x.get('date', ''), reverse=True)
        
        return CustomerMailResponse(
            mail_items=mail_items,
            total_count=len(mail_items)
        )
        
    except Exception as e:
        print(f"Error getting customer mail for admin: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get customer mail")

@router.get("/admin/item/{customer_email}/{mail_id}")
async def get_mail_item_details(customer_email: str, mail_id: str, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Get mail item details by customer email and mail ID (for admin)"""
    try:
        customer_mail_key = get_customer_mail_key(customer_email)
        mail_items = db.storage.json.get(customer_mail_key, default=[])
        
        # Find the mail item
        mail_item = None
        for i, item in enumerate(mail_items):
            if item.get('id') == mail_id:
                mail_item = item
                break
        
        if not mail_item:
            raise HTTPException(status_code=404, detail="Mail item not found")
        
        return {
            "success": True,
            "mail_item": mail_item
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching mail item details: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch mail item details")

@router.delete("/admin/item/{customer_email}/{mail_id}", response_model=GenericResponse)
async def delete_mail_item(customer_email: str, mail_id: str, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Delete a mail item (admin only)"""
    try:
        customer_mail_key = get_customer_mail_key(customer_email)
        mail_items = db.storage.json.get(customer_mail_key, default=[])
        
        # Filter out the mail item
        original_count = len(mail_items)
        mail_items = [item for item in mail_items if item.get('id') != mail_id]
        
        if len(mail_items) == original_count:
             raise HTTPException(status_code=404, detail="Mail item not found")

        # Save updated mail items
        db.storage.json.put(customer_mail_key, mail_items)
        
        print(f"Mail item {mail_id} deleted for customer {customer_email} by admin {admin.email}")
        
        return GenericResponse(
            success=True,
            message="Mail item deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting mail item: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete mail item")

@router.get("/admin/notifications", response_model=AdminNotificationResponse)
async def get_admin_notifications(admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Get all active admin notifications"""
    try:
        notifications = db.storage.json.get("admin_notifications_active", default=[])
        
        # Sort by timestamp descending
        notifications.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        return AdminNotificationResponse(
            notifications=notifications,
            count=len(notifications)
        )
    except Exception as e:
        print(f"Error fetching admin notifications: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch admin notifications")

@router.post("/admin/notifications/mark-read", response_model=GenericResponse)
async def mark_admin_notification_as_read(request: MarkNotificationReadRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Mark an admin notification as read"""
    try:
        notification_key = "admin_notifications_active"
        notifications = db.storage.json.get(notification_key, default=[])
        
        updated = False
        for n in notifications:
            if n.get('id') == request.notification_id:
                n['read'] = True
                updated = True
                break
        
        if updated:
            db.storage.json.put(notification_key, notifications)
            
        return GenericResponse(
            success=True,
            message="Notification marked as read"
        )
    except Exception as e:
        print(f"Error marking notification as read: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to mark notification as read")

@router.post("/mark-as-read", response_model=MarkAsReadResponse)
async def mark_mail_as_read(request: MarkAsReadRequest, user: AuthorizedUser):
    """Mark a mail item as read for the authenticated customer"""
    try:
        customer_mail_key = get_customer_mail_key(user.email)
        mail_items = db.storage.json.get(customer_mail_key, default=[])
        
        # Find the mail item
        mail_item = None
        for i, item in enumerate(mail_items):
            if item.get('id') == request.mail_id:
                # Check if mail belongs to this customer
                if item.get('customer_email') != user.email:
                    raise HTTPException(status_code=403, detail="Not authorized to access this mail item")
                
                # Only mark as read if currently 'new'
                if item.get('status') == 'new':
                    mail_items[i]['status'] = 'read'
                    mail_item = mail_items[i]
                    break
                else:
                    # Already read or in another state
                    mail_item = item
                    break
        
        if not mail_item:
            raise HTTPException(status_code=404, detail="Mail item not found")
        
        # Save updated mail items
        db.storage.json.put(customer_mail_key, mail_items)
        
        return MarkAsReadResponse(
            success=True,
            message="Mail item marked as read successfully",
            mail_id=request.mail_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error marking mail as read: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to mark mail as read")

@router.post("/admin/notifications/complete", response_model=CompleteNotificationResponse)
async def complete_admin_notification(request: CompleteNotificationRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Mark an admin notification as completed and remove it from the list"""
    try:
        notification_key = "admin_notifications_active"
        
        notifications = db.storage.json.get(notification_key, default=[])
        
        # Find and remove the notification
        original_count = len(notifications)
        notifications = [n for n in notifications if n.get('id') != request.notification_id]
        
        # Save updated notifications
        db.storage.json.put(notification_key, notifications)
        
        print(f"Admin notification {request.notification_id} marked as completed")
        
        return CompleteNotificationResponse(
            success=True,
            message="Notification marked as completed successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error completing notification: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to complete notification")

@router.post("/admin/complete-action", response_model=AdminCompleteActionResponse)
async def admin_complete_action(request: AdminCompleteActionRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Complete an admin action and update customer mail item with notifications"""
    try:
        print(f"DEBUG: Admin completing action {request.action} for mail {request.mail_id} (customer: {request.customer_email})")
        
        # 1. Get the customer's mail item
        customer_mail_key = sanitize_storage_key(f"customer_mail_{request.customer_email}")
        mail_items = db.storage.json.get(customer_mail_key, default=[])
        
        # Find the specific mail item
        mail_item = None
        mail_index = -1
        for i, item in enumerate(mail_items):
            if item.get('id') == request.mail_id:
                mail_item = item
                mail_index = i
                break
        
        if not mail_item:
            raise HTTPException(status_code=404, detail="Mail item not found")
        
        # 2. Update the mail item with completion details
        completion_timestamp = datetime.now().isoformat()
        
        # Update the most recent action's status
        if 'actions' in mail_item and mail_item['actions']:
            # Find the most recent action of this type
            for action in reversed(mail_item['actions']):
                if action.get('type', action.get('action')) == request.action and action.get('status') == 'pending':
                    action['status'] = 'completed'
                    action['completed_at'] = completion_timestamp
                    action['admin_notes'] = request.admin_notes
                    if request.scanned_file_key:
                        action['file_key'] = request.scanned_file_key
                    break
        
        # 3. Add completion update to mail item history
        if 'updates' not in mail_item:
            mail_item['updates'] = []
        
        completion_update = {
            'timestamp': completion_timestamp,
            'type': 'admin_completion',
            'action': request.action,
            'message': f"Admin completed {request.action} action",
            'admin_notes': request.admin_notes
        }
        
        # Add scanned file if provided
        if request.scanned_file_key:
            completion_update['file_key'] = request.scanned_file_key
            completion_update['file_type'] = 'scanned_document'
            completion_update['message'] += ' - scanned document attached'
        
        mail_item['updates'].append(completion_update)
        
        # 4. Update mail status based on action
        if request.action in ['recycle', 'shred']:
            mail_item['status'] = 'processed'
        elif request.action == 'scan':
            mail_item['status'] = 'scanned'
        elif request.action == 'forward':
            mail_item['status'] = 'forwarded'
        elif request.action == 'hold':
            mail_item['status'] = 'held'
        
        # 5. Save updated mail items
        mail_items[mail_index] = mail_item
        db.storage.json.put(customer_mail_key, mail_items)
        
        # 6. Send notification to customer
        customer_notified = False
        try:
            send_customer_action_completion_notification(request.customer_email, mail_item, request.action, request.admin_notes, request.scanned_file_key)
            customer_notified = True
        except Exception as e:
            print(f"Failed to send customer completion notification: {str(e)}")
        
        # 7. Remove the admin notification
        try:
            notification_key = "admin_notifications_active"
            notifications = db.storage.json.get(notification_key, default=[])
            notifications = [n for n in notifications if n.get('id') != request.notification_id]
            db.storage.json.put(notification_key, notifications)
        except Exception as e:
            print(f"Failed to remove admin notification: {str(e)}")
        
        return AdminCompleteActionResponse(
            success=True,
            message=f"Action '{request.action}' completed successfully",
            customer_notified=customer_notified
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error completing admin action: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to complete admin action")

@router.post("/admin/parcel/status", response_model=GenericResponse)
async def admin_update_parcel_status(request: AdminUpdateParcelStatusRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Update parcel status (e.g. to 'received' or 'collected')"""
    try:
        customer_mail_key = get_customer_mail_key(request.customer_email)
        mail_items = db.storage.json.get(customer_mail_key, default=[])
        
        updated = False
        mail_item = None
        
        for i, item in enumerate(mail_items):
            if item.get('id') == request.mail_id:
                if item.get('type') != 'parcel':
                    raise HTTPException(status_code=400, detail="Item is not a parcel")
                
                mail_items[i]['status'] = request.status
                mail_item = mail_items[i]
                
                # Add update to history
                if 'updates' not in mail_items[i]:
                    mail_items[i]['updates'] = []
                    
                mail_items[i]['updates'].append({
                    'timestamp': datetime.now().isoformat(),
                    'action': f"status_change_{request.status}",
                    'message': f"Parcel marked as {request.status} by admin",
                    'admin_email': admin.email
                })
                
                updated = True
                break
        
        if not updated:
            raise HTTPException(status_code=404, detail="Mail item not found")
            
        db.storage.json.put(customer_mail_key, mail_items)
        
        # If notification_id provided, mark it as complete
        if request.notification_id:
            try:
                # Reuse the completion logic
                notification_key = "admin_notifications_active"
                notifications = db.storage.json.get(notification_key, default=[])
                notifications = [n for n in notifications if n.get('id') != request.notification_id]
                db.storage.json.put(notification_key, notifications)
            except Exception as e:
                print(f"Error closing notification: {e}")
        
        # Send notification to customer
        try:
            subject = f"Letterbox.es - Parcel Status Update: {request.status.title()}"
            content = f"""
            <html>
            <body>
                <h2>Parcel Update</h2>
                <p>Your parcel from {mail_item.get('sender', 'Unknown')} has been marked as <strong>{request.status}</strong>.</p>
                <p>Tracking: {mail_item.get('tracking_number', 'N/A')}</p>
            </body>
            </html>
            """
            send_email(request.customer_email, subject, content, f"Parcel status update: {request.status}")
        except Exception as e:
            print(f"Error sending customer notification: {e}")

        return GenericResponse(success=True, message=f"Parcel status updated to {request.status}")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating parcel status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update parcel status")

@router.post("/admin/parcel/details", response_model=GenericResponse)
async def admin_update_parcel_details(request: AdminUpdateParcelDetailsRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Update parcel tracking and sender details"""
    try:
        customer_mail_key = get_customer_mail_key(request.customer_email)
        mail_items = db.storage.json.get(customer_mail_key, default=[])
        
        updated = False
        
        for i, item in enumerate(mail_items):
            if item.get('id') == request.mail_id:
                if item.get('type') != 'parcel':
                    raise HTTPException(status_code=400, detail="Item is not a parcel")
                
                mail_items[i]['tracking_number'] = request.tracking_number
                mail_items[i]['sender'] = request.sender
                
                # Add update to history
                if 'updates' not in mail_items[i]:
                    mail_items[i]['updates'] = []
                    
                mail_items[i]['updates'].append({
                    'timestamp': datetime.now().isoformat(),
                    'action': "details_update",
                    'message': f"Parcel details updated by admin. Tracking: {request.tracking_number}, Sender: {request.sender}",
                    'admin_email': admin.email
                })
                
                updated = True
                break
        
        if not updated:
            raise HTTPException(status_code=404, detail="Mail item not found")
            
        db.storage.json.put(customer_mail_key, mail_items)
        
        return GenericResponse(success=True, message="Parcel details updated successfully")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating parcel details: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update parcel details")

@router.post("/admin/parcel/reminder", response_model=GenericResponse)
async def admin_send_parcel_reminder(request: AdminSendParcelReminderRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Send a reminder to customer to add tracking information"""
    try:
        # Get mail item for details
        customer_mail_key = get_customer_mail_key(request.customer_email)
        mail_items = db.storage.json.get(customer_mail_key, default=[])
        mail_item = next((item for item in mail_items if item.get('id') == request.mail_id), None)
        
        if not mail_item:
            raise HTTPException(status_code=404, detail="Mail item not found")

        subject = "Action Required: Please add tracking for your parcel"
        content = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="background-color: #f9f9f9; padding: 20px;">
                <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #eab308;">Tracking Information Required</h2>
                    <p>Hello,</p>
                    <p>You have a pending parcel booking with us.</p>
                    <p>Please log in to your account and add the <strong>Tracking Number</strong> and <strong>Origin/Sender</strong> for your expected parcel.</p>
                    <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Booking Date:</strong> {mail_item.get('date')}</p>
                        <p style="margin: 5px 0 0 0;"><strong>Status:</strong> {mail_item.get('status').title()}</p>
                    </div>
                    <p>Adding this information helps us identify and process your parcel quickly when it arrives.</p>
                    <p>Best regards,<br>Letterbox.es Team</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        send_email(request.customer_email, subject, content, "Please add tracking information for your parcel booking.")
        
        return GenericResponse(success=True, message="Reminder email sent successfully")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error sending reminder: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send reminder")

@router.get("/admin/mail-audit", response_model=MailItemAuditResponse)
async def get_all_mail_items_audit(admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Get all mail items from all customers for audit purposes"""
    try:
        all_items = []
        
        # 1. Fetch all customers to get names mapping
        customers_map = {} # email -> name
        try:
            customers_list = db.storage.json.list()
            # simple filter for customer files
            for f in customers_list:
                if f.name.startswith("customer_email_"):
                    try:
                        data = db.storage.json.get(f.name)
                        if data and data.get("email"):
                            customers_map[data.get("email")] = data.get("full_name", "Unknown")
                    except Exception as inner_e:
                        print(f"Error reading customer file {f.name}: {inner_e}")
                        continue
        except Exception as e:
            print(f"Error listing customer files: {e}")

        # 2. Iterate through all customers to get their mail
        for email, name in customers_map.items():
            customer_mail_key = get_customer_mail_key(email)
            try:
                mail_items = db.storage.json.get(customer_mail_key, default=[])
                
                for item in mail_items:
                    # Enrich with customer info
                    audit_item = item.copy()
                    audit_item['customer_name'] = name
                    audit_item['customer_email'] = email # Ensure email is present
                    all_items.append(audit_item)

            except Exception as e:
                print(f"Error processing mail for {email}: {e}")
                continue

        # 3. Sort by date descending
        all_items.sort(key=lambda x: x.get('date', ''), reverse=True)

        return MailItemAuditResponse(
            items=all_items,
            count=len(all_items)
        )
    except Exception as e:
        print(f"Error fetching all mail items audit: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch mail items for audit")

@router.get("/admin/activity-log", response_model=ActivityLogResponse)
async def get_global_activity_log(admin: Annotated[AuthorizedUser, Depends(get_current_admin)]):
    """Get full audit trail of all mail actions for all customers"""
    try:
        all_logs = []
        
        # 1. Fetch all customers to get names mapping
        customers_map = {} # email -> name
        try:
            customers_list = db.storage.json.list()
            # simple filter for customer files
            for f in customers_list:
                if f.name.startswith("customer_email_"):
                    try:
                        data = db.storage.json.get(f.name)
                        if data.get("email"):
                            customers_map[data.get("email")] = data.get("full_name", "Unknown")
                    except Exception as inner_e:
                        print(f"Error reading customer file {f.name}: {inner_e}")
                        continue
        except Exception as e:
            print(f"Error fetching customers for map: {e}")

        # 2. Iterate through all customers to get their mail
        for email, name in customers_map.items():
            customer_mail_key = get_customer_mail_key(email)
            try:
                mail_items = db.storage.json.get(customer_mail_key, default=[])
                
                for item in mail_items:
                    mail_id = item.get('id', 'unknown')
                    sender = item.get('sender', 'Unknown')
                    
                    # Process Customer Requests (Actions)
                    if 'actions' in item:
                        for action in item['actions']:
                            log_id = action.get('id') or f"log_{mail_id}_{action.get('timestamp')}"
                            all_logs.append(ActivityLogEntry(
                                id=log_id,
                                timestamp=action.get('timestamp', ''),
                                customer_email=email,
                                customer_name=name,
                                action_type=action.get('type', 'unknown'),
                                performed_by='customer',
                                details=f"Customer requested: {action.get('type')} - Notes: {action.get('notes', 'None')}",
                                mail_id=mail_id,
                                mail_sender=sender
                            ))

                    # Process Admin Updates (Completions)
                    if 'updates' in item:
                        for update in item['updates']:
                            # Generate a unique ID for updates if not present
                            update_id = f"update_{mail_id}_{update.get('timestamp')}"
                            all_logs.append(ActivityLogEntry(
                                id=update_id,
                                timestamp=update.get('timestamp', ''),
                                customer_email=email,
                                customer_name=name,
                                action_type=update.get('action', update.get('type', 'unknown')),
                                performed_by='admin',
                                details=update.get('message', ''),
                                mail_id=mail_id,
                                mail_sender=sender
                            ))
                            
                    # Add "Created" event if available
                    if item.get('created_at'):
                        # Determine if this was a customer parcel booking or admin creation
                        is_parcel_booking = item.get('type') == 'parcel'
                        
                        action_type = "parcel_booking" if is_parcel_booking else "created"
                        performed_by = "customer" if is_parcel_booking else "admin"
                        details = "Parcel booking confirmed" if is_parcel_booking else "Mail item created"

                        all_logs.append(ActivityLogEntry(
                            id=f"created_{mail_id}",
                            timestamp=item.get('created_at'),
                            customer_email=email,
                            customer_name=name,
                            action_type=action_type,
                            performed_by=performed_by, # Usually admin creates mail items
                            details=details,
                            mail_id=mail_id,
                            mail_sender=sender
                        ))

            except Exception as e:
                print(f"Error processing mail for {email}: {e}")
                continue

        # 3. Sort by timestamp descending
        all_logs.sort(key=lambda x: x.timestamp, reverse=True)

        return ActivityLogResponse(
            logs=all_logs,
            count=len(all_logs)
        )

    except Exception as e:
        print(f"Error generating global activity log: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate activity log")
