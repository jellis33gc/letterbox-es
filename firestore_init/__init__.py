from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from datetime import datetime, timedelta
import databutton as db
from app.auth import AuthorizedUser

router = APIRouter(prefix="/firestore")

# Response models
class InitializeResponse(BaseModel):
    success: bool
    message: str
    customers_created: int
    mail_items_created: int

class CustomerData(BaseModel):
    user_id: str
    full_name: str
    address: str
    mailbox_number: str
    email: str
    telephone: str
    subscription_plan: str

class MailItemData(BaseModel):
    customer_email: str
    envelope_image_url: str
    date_received: str
    sender: str
    priority: str
    status: str

@router.post("/initialize", response_model=InitializeResponse)
async def initialize_firestore_data():
    """Initialize Firestore with sample customers and mail items"""
    try:
        # Sample customers data
        sample_customers = [
            {
                "user_id": "test-user-id",
                "full_name": "John Smith",
                "address": "123 Main Street, London, SW1A 1AA",
                "mailbox_number": "MB001",
                "email": "test@letterbox.es",
                "telephone": "+44 20 1234 5678",
                "subscription_plan": "receive-and-scan"
            },
            {
                "user_id": "test-user-2",
                "full_name": "Sarah Johnson",
                "address": "456 Oak Avenue, Manchester, M1 1AA",
                "mailbox_number": "MB002",
                "email": "sarah@letterbox.es",
                "telephone": "+44 161 234 5678",
                "subscription_plan": "receive-and-forward"
            },
            {
                "user_id": "test-user-3",
                "full_name": "Michael Brown",
                "address": "789 High Street, Birmingham, B1 1AA",
                "mailbox_number": "MB003",
                "email": "michael@letterbox.es",
                "telephone": "+44 121 234 5678",
                "subscription_plan": "receive-only"
            }
        ]
        
        # Sample mail items data
        current_time = datetime.now()
        sample_mail_items = [
            {
                "customer_email": "test@letterbox.es",
                "envelope_image_url": "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&h=600&fit=crop",
                "date_received": (current_time - timedelta(days=1)).isoformat(),
                "sender": "HMRC",
                "priority": "urgent",
                "status": "new"
            },
            {
                "customer_email": "test@letterbox.es",
                "envelope_image_url": "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&h=600&fit=crop",
                "date_received": (current_time - timedelta(days=2)).isoformat(),
                "sender": "Barclays Bank",
                "priority": "normal",
                "status": "processed"
            },
            {
                "customer_email": "test@letterbox.es",
                "envelope_image_url": "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&h=600&fit=crop",
                "date_received": (current_time - timedelta(days=3)).isoformat(),
                "sender": "NHS",
                "priority": "normal",
                "status": "pending"
            },
            {
                "customer_email": "sarah@letterbox.es",
                "envelope_image_url": "https://images.unsplash.com/photo-1595846519845-68e298c2edd8?w=800&h=600&fit=crop",
                "date_received": (current_time - timedelta(hours=12)).isoformat(),
                "sender": "Royal Mail",
                "priority": "normal",
                "status": "new"
            },
            {
                "customer_email": "michael@letterbox.es",
                "envelope_image_url": "https://images.unsplash.com/photo-1605460375648-278bcbd579a6?w=800&h=600&fit=crop",
                "date_received": (current_time - timedelta(hours=6)).isoformat(),
                "sender": "BT",
                "priority": "normal",
                "status": "new"
            }
        ]
        
        # Store sample data to be used by frontend
        db.storage.json.put("firestore_sample_customers", sample_customers)
        db.storage.json.put("firestore_sample_mail_items", sample_mail_items)
        
        return InitializeResponse(
            success=True,
            message="Sample data prepared for Firestore initialization. Use the frontend to initialize Firestore collections.",
            customers_created=len(sample_customers),
            mail_items_created=len(sample_mail_items)
        )
        
    except Exception as e:
        print(f"Error preparing sample data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to prepare sample data")

@router.get("/sample-data/customers")
async def get_sample_customers() -> List[CustomerData]:
    """Get sample customer data for Firestore initialization"""
    try:
        customers = db.storage.json.get("firestore_sample_customers", default=[])
        return [CustomerData(**customer) for customer in customers]
    except Exception as e:
        print(f"Error getting sample customers: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get sample customers")

@router.get("/sample-data/mail-items")
async def get_sample_mail_items() -> List[MailItemData]:
    """Get sample mail items data for Firestore initialization"""
    try:
        mail_items = db.storage.json.get("firestore_sample_mail_items", default=[])
        return [MailItemData(**item) for item in mail_items]
    except Exception as e:
        print(f"Error getting sample mail items: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get sample mail items")
