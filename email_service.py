import os
import resend
import uuid
from typing import List, Optional, Dict, Any
from app.env import mode, Mode

# Initialize Resend with API key
# Note: In production, ensure RESEND_API_KEY is set in environment variables
resend.api_key = os.environ.get("RESEND_API_KEY")

DEFAULT_SENDER = "Letterbox.es <info@letterbox.es>"

def send_email(
    to: str | List[str],
    subject: str,
    html: str,
    text: Optional[str] = None,
    sender: str = DEFAULT_SENDER,
    reply_to: Optional[str] = None,
    headers: Optional[Dict[str, str]] = None,
    attachments: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Send an email using Resend.
    
    Args:
        to: Recipient email address or list of addresses
        subject: Email subject
        html: HTML content of the email
        text: Plain text content of the email (optional but recommended)
        sender: Sender address (default: info@letterbox.es)
        reply_to: Reply-to address (optional)
        headers: Custom headers (optional)
        attachments: List of attachments (optional)
        
    Returns:
        Dict containing the response from Resend (e.g. {'id': '...'})
    """
    if not resend.api_key:
        print(f"WARNING: RESEND_API_KEY not found. Mocking email send.")
        print(f"To: {to}")
        print(f"Subject: {subject}")
        return {"id": "mock-id", "warning": "RESEND_API_KEY not set"}

    if isinstance(to, str):
        to = [to]
        
    # Prepare params
    params = {
        "from": sender,
        "to": to,
        "subject": subject,
        "html": html,
    }
    
    if text:
        params["text"] = text
        
    if reply_to:
        params["reply_to"] = reply_to
        
    if attachments:
        params["attachments"] = attachments
        
    # Handle headers and Idempotency-Key
    if headers is None:
        headers = {}
        
    # Ensure Idempotency-Key is present if not provided
    if "Idempotency-Key" not in headers:
        headers["Idempotency-Key"] = str(uuid.uuid4())
        
    params["headers"] = headers

    try:
        response = resend.Emails.send(params)
        return response
    except Exception as e:
        error_msg = str(e)
        # Check for domain verification error
        if "domain is not verified" in error_msg and mode == Mode.DEV:
            print(f"WARNING: Resend domain not verified. Falling back to MOCK email for DEV environment.")
            print(f"To: {to}")
            print(f"Subject: {subject}")
            print(f"From: {sender}")
            # print(f"Content: {text or html}") # Optional: print content
            return {"id": "mock-fallback-id", "warning": "Domain not verified, used mock fallback"}
            
        print(f"Error sending email via Resend: {str(e)}")
        # Re-raise to let caller handle or log specifically
        raise e
