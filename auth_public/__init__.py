from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr
import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
import json
import os
import string
import secrets
import re
import databutton as db
from app.libs.email_service import send_email

router = APIRouter()

def sanitize_storage_key(key: str) -> str:
    """Sanitize storage key to only allow alphanumeric and ._- symbols"""
    return re.sub(r'[^a-zA-Z0-9._-]', '', key)

class ResetPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordResponse(BaseModel):
    success: bool
    message: str

def initialize_firebase_admin():
    if not firebase_admin._apps:
        try:
            service_account_info = json.loads(os.environ.get("FIREBASE_ADMIN_SERVICE_ACCOUNT"))
            cred = credentials.Certificate(service_account_info)
            firebase_admin.initialize_app(cred)
        except Exception as e:
            print(f"Failed to initialize Firebase Admin SDK: {str(e)}")
            raise

def generate_secure_password(length: int = 12) -> str:
    """Generate a secure temporary password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return password

class PublicSignupRequest(BaseModel):
    full_name: str
    email: EmailStr
    telephone: str | None = None
    address: str
    subscription_plan: str
    subscription_interval: str
    has_business_address: bool | None = False

class PublicSignupResponse(BaseModel):
    success: bool
    message: str
    customer: dict | None = None

@router.post("/signup", response_model=PublicSignupResponse)
def public_signup(request: PublicSignupRequest) -> PublicSignupResponse:
    """Create a new pending customer account before KYC"""
    try:
        from app.apis.customer_management import Customer, get_all_customers_internal, save_customers_internal, generate_mailbox_number
        from datetime import datetime
        import uuid
        
        customers = get_all_customers_internal()
        
        # Check if email exists
        if any(c.get("email") == request.email for c in customers):
            raise HTTPException(status_code=400, detail="Email already registered")
            
        # Create pending customer
        new_id = str(uuid.uuid4())
        
        new_customer = {
            "id": new_id,
            "full_name": request.full_name,
            "email": request.email,
            "telephone": request.telephone,
            "address": request.address,
            "mailbox_number": generate_mailbox_number(),
            "subscription_plan": request.subscription_plan,
            "status": "pending_verification",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "subscription_interval": request.subscription_interval,
            "has_business_address": request.has_business_address
        }
        
        customers.append(new_customer)
        save_customers_internal(customers)
        
        return PublicSignupResponse(
            success=True,
            message="Signup successful. Proceed to verification.",
            customer=new_customer
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to complete signup")

@router.post("/send-password-reset", response_model=ResetPasswordResponse)
def send_password_reset_email(request: ResetPasswordRequest) -> ResetPasswordResponse:
    """
    Send a password reset email with a new temporary password.
    This approach is more reliable than generating reset links.
    """
    try:
        # Initialize Firebase Admin if not already done
        initialize_firebase_admin()
        
        # Generate a new temporary password
        temp_password = generate_secure_password()
        
        # Get user by email first to check if they exist
        try:
            user_record = firebase_auth.get_user_by_email(request.email)
        except firebase_auth.UserNotFoundError:
            # Don't reveal that the user doesn't exist for security
            return ResetPasswordResponse(
                success=True,
                message="If an account with this email exists, a password reset email has been sent"
            )
        
        # Update user password directly
        firebase_auth.update_user(
            user_record.uid,
            password=temp_password
        )
        
        # Send email with new temporary password
        reset_email_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #f59e0b;">Password Reset - Letterbox.es</h2>
                
                <p>You requested a password reset for your Letterbox.es account.</p>
                
                <p>Your password has been reset. You can now log in with your new temporary password:</p>
                
                <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Email:</strong> {request.email}</p>
                    <p><strong>New Temporary Password:</strong> <code style="background: #e5e5e5; padding: 2px 4px; border-radius: 3px;">{temp_password}</code></p>
                </div>
                
                <p><strong>Important:</strong> Please change this password after logging in for security.</p>
                
                <p>You can access your mailbox at: <a href="https://app.letterbox.es" style="color: #f59e0b;">https://app.letterbox.es</a></p>
                
                <p>If you didn't request this password reset, please contact our support team immediately.</p>
                
                <p>Best regards,<br>The Letterbox.es Team</p>
            </div>
        </body>
        </html>
        """
        
        # Send reset email using Resend
        try:
            send_email(
                to=request.email,
                subject="Your Letterbox.es Password Has Been Reset",
                html=reset_email_content,
                text=f"Your Letterbox.es password has been reset. Email: {request.email}, New Temporary Password: {temp_password}. Please change this password after logging in."
            )
            print(f"Password reset email sent to {request.email}")
        except Exception as email_error:
            print(f"Failed to send password reset email: {email_error}")
            raise HTTPException(status_code=500, detail="Failed to send password reset email")
        
        print(f"Password reset completed for {request.email}")
        
        return ResetPasswordResponse(
            success=True,
            message="Password reset email sent successfully"
        )
        
    except Exception as e:
        print(f"Error resetting password: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to send password reset email"
        ) from e

@router.get("/envelope/{file_key}")
async def get_envelope_preview(file_key: str):
    """Get envelope preview by file key (public access for img tags)"""
    try:
        # Sanitize the file key
        safe_key = sanitize_storage_key(file_key)
        
        # Get file from storage
        try:
            file_content = db.storage.binary.get(safe_key)
        except FileNotFoundError:
             raise HTTPException(status_code=404, detail="Envelope preview not found")
        
        # Determine media type based on file extension
        media_type = "image/jpeg"  # default
        if file_key.lower().endswith('.pdf'):
            media_type = "application/pdf"
        elif file_key.lower().endswith('.png'):
            media_type = "image/png"
        elif file_key.lower().endswith('.jpg') or file_key.lower().endswith('.jpeg'):
            media_type = "image/jpeg"
        
        # Return file content with appropriate headers
        return Response(
            content=file_content,
            media_type=media_type,
            headers={
                "Cache-Control": "public, max-age=3600",
                "Content-Disposition": f"inline; filename={file_key}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error retrieving envelope preview: {str(e)}")
        raise HTTPException(status_code=404, detail="Envelope preview not found")
