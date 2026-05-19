import databutton as db
from datetime import datetime
import re

def sanitize_storage_key(key: str) -> str:
    """Sanitize storage key to only allow alphanumeric and ._- symbols"""
    return re.sub(r'[^a-zA-Z0-9._-]', '', key)

def create_admin_notification(mail_item: dict, action: str, customer_email: str, details: dict = None):
    """Create in-app notification for admin"""
    try:
        # Use a single persistent key for all active notifications instead of daily keys
        notification_key = "admin_notifications_active"
        
        # Get existing notifications
        notifications = db.storage.json.get(notification_key, default=[])
        
        # Ensure details has action if not provided
        if details is None:
            details = {"action": action}
        elif "action" not in details:
            details["action"] = action
        
        # Add tracking number if available in mail_item
        if mail_item.get('tracking_number'):
            details['tracking_number'] = mail_item.get('tracking_number')

        # Add new notification
        new_notification = {
            "id": sanitize_storage_key(f"notif_{mail_item.get('id', 'unknown')}_{datetime.now().strftime('%Y%m%d%H%M%S')}"),
            "timestamp": datetime.now().isoformat(),
            "type": "mail_action" if action != "parcel_booking" else "parcel_booking",
            "customer_email": customer_email,
            "mail_id": mail_item.get('id'),
            "sender": mail_item.get('sender'),
            "details": details,
            "status": "pending",
            "read": False
        }
        
        notifications.append(new_notification)
        
        # Keep only last 500 notifications to prevent unbounded growth
        if len(notifications) > 500:
            notifications = notifications[-500:]
        
        db.storage.json.put(notification_key, notifications)
        print(f"Admin notification created for action: {action}")
        
    except Exception as e:
        print(f"Failed to create admin notification: {str(e)}")
