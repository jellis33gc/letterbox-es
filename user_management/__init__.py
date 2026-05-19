from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Annotated
from firebase_admin import auth as firebase_auth
import databutton as db
import json
import secrets
import string
import firebase_admin
from firebase_admin import credentials
import os
from app.auth import AuthorizedUser
from app.libs.admin_auth import get_current_admin
from app.libs.email_service import send_email

router = APIRouter()

# Initialize Firebase Admin SDK
def initialize_firebase_admin():
    if not firebase_admin._apps:
        try:
            service_account_info = json.loads(os.environ.get("FIREBASE_ADMIN_SERVICE_ACCOUNT"))
            cred = credentials.Certificate(service_account_info)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK initialized successfully")
        except Exception as e:
            print(f"Failed to initialize Firebase Admin SDK: {str(e)}")
            raise

class CreateUserRequest(BaseModel):
    email: EmailStr
    full_name: str
    send_welcome_email: bool = True

class CreateUserResponse(BaseModel):
    uid: str
    email: str
    temporary_password: str
    user_created: bool
    welcome_email_sent: bool

class ResetPasswordRequest(BaseModel):
    email: EmailStr

class ResendLoginDetailsRequest(BaseModel):
    email: EmailStr

class ResendLoginDetailsResponse(BaseModel):
    success: bool
    message: str

class SetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str

class SetPasswordResponse(BaseModel):
    success: bool
    message: str

class GetFirebaseUserRequest(BaseModel):
    email: EmailStr

class GetFirebaseUserResponse(BaseModel):
    success: bool
    uid: str
    email: str
    display_name: str | None
    email_verified: bool
    message: str

class AdminSetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str

class ImpersonateUserRequest(BaseModel):
    email: EmailStr

class ImpersonateUserResponse(BaseModel):
    success: bool
    custom_token: str
    message: str

def generate_secure_password(length: int = 12) -> str:
    """Generate a secure temporary password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return password

@router.post("/create-user", response_model=CreateUserResponse)
def create_firebase_user(request: CreateUserRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]) -> CreateUserResponse:
    """
    Create a Firebase user account for a new customer.
    This should be called when an admin creates a new customer.
    """
    try:
        # Initialize Firebase Admin if not already done
        initialize_firebase_admin()
        
        # Generate a secure temporary password
        temp_password = generate_secure_password()
        
        # Create Firebase user
        user_record = firebase_auth.create_user(
            email=request.email,
            password=temp_password,
            display_name=request.full_name,
            email_verified=False  # User will verify when they first log in
        )
        
        welcome_email_sent = False
        
        # Send welcome email with temporary password
        if request.send_welcome_email:
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
                try:
                    send_email(
                        to=request.email,
                        subject="Welcome to Letterbox.es - Your Account is Ready",
                        html=welcome_content,
                        text=f"Welcome to Letterbox.es! Your account has been created. Email: {request.email}, Temporary Password: {temp_password}. Please change your password when you first log in."
                    )
                    welcome_email_sent = True
                    print(f"Welcome email sent to {request.email}")
                except Exception as email_error:
                    print(f"Failed to send welcome email: {email_error}")
                    # Don't fail the whole operation if email fails
            except Exception as email_error:
                print(f"Failed to prepare welcome email: {email_error}")
        
        return CreateUserResponse(
            uid=user_record.uid,
            email=user_record.email,
            temporary_password=temp_password,
            user_created=True,
            welcome_email_sent=welcome_email_sent
        )
        
    except firebase_auth.EmailAlreadyExistsError as e:
        raise HTTPException(
            status_code=400,
            detail="A user with this email address already exists"
        ) from e
    except Exception as e:
        print(f"Error creating user: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create user account: {str(e)}"
        ) from e

@router.post("/admin-set-password", response_model=SetPasswordResponse)
def admin_set_password(request: AdminSetPasswordRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]) -> SetPasswordResponse:
    """
    Admin function to set a specific password for a user.
    """
    try:
        # Initialize Firebase Admin if not already done
        initialize_firebase_admin()
        
        # Get user by email
        user_record = firebase_auth.get_user_by_email(request.email)
        
        # Update user password
        firebase_auth.update_user(
            user_record.uid,
            password=request.new_password
        )
        
        print(f"Admin set password completed for {request.email}")
        
        return SetPasswordResponse(
            success=True,
            message=f"Password updated successfully for {request.email}"
        )
        
    except firebase_auth.UserNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        ) from e
    except Exception as e:
        print(f"Error in admin set password: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to set password: {str(e)}"
        ) from e

@router.post("/get-firebase-user", response_model=GetFirebaseUserResponse)
def get_firebase_user_by_email(request: GetFirebaseUserRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]) -> GetFirebaseUserResponse:
    """
    Get Firebase user details by email address.
    """
    try:
        # Initialize Firebase Admin if not already done
        initialize_firebase_admin()
        
        # Get user by email
        user_record = firebase_auth.get_user_by_email(request.email)
        
        return GetFirebaseUserResponse(
            success=True,
            uid=user_record.uid,
            email=user_record.email,
            display_name=user_record.display_name,
            email_verified=user_record.email_verified,
            message=f"Firebase user found for {request.email}"
        )
        
    except firebase_auth.UserNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail=f"Firebase user not found for email: {request.email}"
        ) from e
    except Exception as e:
        print(f"Error getting Firebase user: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get Firebase user: {str(e)}"
        ) from e

@router.post("/admin-reset-password", response_model=SetPasswordResponse)
def admin_reset_customer_password(request: ResetPasswordRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]) -> SetPasswordResponse:
    """
    Admin function to reset a customer's password and send them a new temporary password.
    """
    try:
        # Initialize Firebase Admin if not already done
        initialize_firebase_admin()
        
        # Generate new temporary password
        new_temp_password = generate_secure_password()
        
        # Get user by email
        user_record = firebase_auth.get_user_by_email(request.email)
        
        # Update user password
        firebase_auth.update_user(
            user_record.uid,
            password=new_temp_password
        )
        
        # Send email with new temporary password
        reset_email_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #f59e0b;">Password Reset - Letterbox.es</h2>
                
                <p>Your password has been reset by an administrator.</p>
                
                <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Email:</strong> {request.email}</p>
                    <p><strong>New Temporary Password:</strong> <code style="background: #e5e5e5; padding: 2px 4px; border-radius: 3px;">{new_temp_password}</code></p>
                </div>
                
                <p><strong>Important:</strong> Please change this password when you log in for security.</p>
                
                <p>You can access your mailbox at: <a href="https://app.letterbox.es" style="color: #f59e0b;">https://app.letterbox.es</a></p>
                
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
                text=f"Your password has been reset. Email: {request.email}, New Temporary Password: {new_temp_password}. Please change this password when you log in."
            )
            print(f"Admin password reset email sent to {request.email}")
        except Exception as email_error:
            print(f"Failed to send admin password reset email: {email_error}")
            raise HTTPException(status_code=500, detail="Failed to send password reset email")
        
        print(f"Admin password reset completed for {request.email}")
        
        return SetPasswordResponse(
            success=True,
            message=f"Password reset successfully. New temporary password sent to {request.email}"
        )
        
    except firebase_auth.UserNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        ) from e
    except Exception as e:
        print(f"Error in admin reset password: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset password: {str(e)}"
        ) from e

@router.post("/impersonate-user", response_model=ImpersonateUserResponse)
def impersonate_user(request: ImpersonateUserRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]) -> ImpersonateUserResponse:
    """
    Generate a custom token for an admin to impersonate a customer.
    """
    try:
        initialize_firebase_admin()
        
        # Get user by email to ensure they exist and get their UID
        user_record = firebase_auth.get_user_by_email(request.email)
        
        # Create a custom token for the user
        custom_token = firebase_auth.create_custom_token(user_record.uid)
        
        return ImpersonateUserResponse(
            success=True,
            custom_token=custom_token.decode('utf-8') if isinstance(custom_token, bytes) else custom_token,
            message="Impersonation token generated successfully"
        )
        
    except firebase_auth.UserNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail="User not found in Firebase Auth"
        ) from e
    except Exception as e:
        print(f"Error generating impersonation token: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate impersonation token: {str(e)}"
        ) from e

@router.post("/resend-login-details", response_model=ResendLoginDetailsResponse)
def resend_login_details(request: ResendLoginDetailsRequest, admin: Annotated[AuthorizedUser, Depends(get_current_admin)]) -> ResendLoginDetailsResponse:
    """
    Resend login details (new temporary password) to a customer.
    This is effectively a password reset but with a "Here are your details" email template.
    """
    try:
        # Initialize Firebase Admin if not already done
        initialize_firebase_admin()
        
        # Generate new temporary password
        new_temp_password = generate_secure_password()
        
        # Get user by email
        user_record = firebase_auth.get_user_by_email(request.email)
        
        # Update user password
        firebase_auth.update_user(
            user_record.uid,
            password=new_temp_password
        )
        
        # Send email with new temporary password
        login_details_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #f59e0b;">Your Letterbox.es Login Details</h2>
                
                <p>Hello,</p>
                
                <p>Here are your requested login details for Letterbox.es.</p>
                
                <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Email:</strong> {request.email}</p>
                    <p><strong>Temporary Password:</strong> <code style="background: #e5e5e5; padding: 2px 4px; border-radius: 3px;">{new_temp_password}</code></p>
                </div>
                
                <p><strong>Important:</strong> Please change this password when you log in for security.</p>
                
                <p>You can access your mailbox at: <a href="https://app.letterbox.es" style="color: #f59e0b;">https://app.letterbox.es</a></p>
                
                <p>Best regards,<br>The Letterbox.es Team</p>
            </div>
        </body>
        </html>
        """
        
        # Send email using Resend
        try:
            send_email(
                to=request.email,
                subject="Your Letterbox.es Login Details",
                html=login_details_content,
                text=f"Here are your login details for Letterbox.es. Email: {request.email}, Temporary Password: {new_temp_password}. Please change this password when you log in."
            )
            print(f"Login details email sent to {request.email}")
        except Exception as email_error:
            print(f"Failed to send login details email: {email_error}")
            raise HTTPException(status_code=500, detail="Failed to send login details email")
        
        print(f"Resend login details completed for {request.email}")
        
        return ResendLoginDetailsResponse(
            success=True,
            message=f"Login details sent to {request.email}"
        )
        
    except firebase_auth.UserNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        ) from e
    except Exception as e:
        print(f"Error in resend login details: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to resend login details: {str(e)}"
        ) from e
