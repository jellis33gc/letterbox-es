from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import databutton as db
from datetime import datetime
import uuid
from app.libs.email_service import send_email

router = APIRouter()

class SupportRequest(BaseModel):
    name: str
    email: str
    subject: str
    message: str

class SupportResponse(BaseModel):
    success: bool
    message: str

@router.post("/send-support-request", response_model=SupportResponse)
async def send_support_request(request: SupportRequest) -> SupportResponse:
    """Send a support request email to help@letterbox.es"""
    try:
        # Validate input
        if not all([request.name, request.email, request.subject, request.message]):
            raise HTTPException(status_code=400, detail="All fields are required")
        
        # Create email content with customer details prominently displayed
        subject = request.subject  # Use only the customer's subject
        
        content_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="background-color: #f9f9f9; padding: 20px;">
                <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #eab308; margin: 0;">Letterbox.es Support Request</h1>
                    </div>
                    
                    <h2 style="color: #333; margin-bottom: 20px;">New Support Request</h2>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>From:</strong> {request.name}</p>
                        <p style="margin: 5px 0 0 0;"><strong>Email:</strong> {request.email}</p>
                        <p style="margin: 5px 0 0 0;"><strong>Subject:</strong> {request.subject}</p>
                        <p style="margin: 15px 0 0 0;"><strong>Submitted:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
                    </div>
                    
                    <div style="background-color: #ffffff; padding: 20px; border-left: 4px solid #eab308; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Message:</h3>
                        <p style="line-height: 1.6; white-space: pre-wrap;">{request.message}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="color: #666; font-size: 12px; margin: 0;">This support request was sent via the Letterbox.es customer portal.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        content_text = f"""
Letterbox.es Support Request

From: {request.name}
Email: {request.email}
Subject: {request.subject}
Submitted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}

Message:
{request.message}

---
This support request was sent via the Letterbox.es customer portal.
        """
        
        # Send email to support team (customer email prominently displayed in subject and content)
        # Send email using Resend
        try:
            send_email(
                to="info@letterbox.es",
                subject=f"Support Request: {subject}",
                html=content_html,
                text=content_text,
                reply_to=request.email
            )
            print(f"Sent support request via Resend from {request.email}")
        except Exception as e:
            print(f"Failed to send support email: {str(e)}")
            # Continue to save to storage even if email fails
        
        print(f"Support request sent from {request.email} - Subject: {request.subject}")
        
        # Store inquiry in storage
        inquiry_data = {
            "id": str(uuid.uuid4()),
            "name": request.name,
            "email": request.email,
            "subject": request.subject,
            "message": request.message,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            inquiries = db.storage.json.get("support_inquiries", default=[])
            inquiries.append(inquiry_data)
            db.storage.json.put("support_inquiries", inquiries)
            print(f"Stored support inquiry: {inquiry_data['id']}")
        except Exception as store_error:
            print(f"Failed to store support inquiry: {store_error}")
            # Don't fail the request if storage fails, just log it
        
        return SupportResponse(
            success=True,
            message="Support request sent successfully. We'll get back to you soon!"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error sending support request: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send support request")
