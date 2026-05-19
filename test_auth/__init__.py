from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import databutton as db
import json
import firebase_admin
from firebase_admin import credentials, auth
import os

router = APIRouter(prefix="/auth")

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

# Response models
class CreateTestUserResponse(BaseModel):
    success: bool
    message: str
    email: str
    password: str
    user_created: bool
    customer_created: bool

@router.post("/create-test-user", response_model=CreateTestUserResponse)
async def create_test_user():
    """Create a test user account with customer data for testing"""
    try:
        # Initialize Firebase Admin if not already done
        initialize_firebase_admin()
        
        # Test user credentials
        test_email = "test@letterbox.es"
        test_password = "testuser123"
        
        user_created = False
        
        try:
            # Try to create the user in Firebase Auth
            user_record = auth.create_user(
                email=test_email,
                password=test_password,
                display_name="Test User",
                email_verified=True
            )
            user_created = True
            print(f"Successfully created test user with UID: {user_record.uid}")
            
        except auth.EmailAlreadyExistsError:
            print("Test user already exists in Firebase Auth")
            user_created = False
        except Exception as e:
            print(f"Error creating Firebase user: {str(e)}")
            # Continue anyway, user might already exist
        
        # Store test user credentials for reference
        test_user_data = {
            "email": test_email,
            "password": test_password,
            "created_for_testing": True,
            "user_created_in_firebase": user_created,
            "instructions": [
                "1. Use the credentials above to log in on the home page",
                "2. Go to the Inbox page after logging in",
                "3. Click 'Load Sample Data' to initialize your mailbox with test mail",
                "4. Test the mail actions based on your subscription plan",
                "5. Check the Admin page to see notifications and manage mail"
            ]
        }
        
        # Store in database for reference
        db.storage.json.put("test_user_credentials", test_user_data)
        
        return CreateTestUserResponse(
            success=True,
            message="Test user created successfully!" if user_created else "Test user credentials prepared (user may already exist)",
            email=test_email,
            password=test_password,
            user_created=user_created,
            customer_created=False  # Customer will be created when sample data is loaded
        )
        
    except Exception as e:
        print(f"Error creating test user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create test user: {str(e)}")

@router.get("/test-credentials")
async def get_test_credentials():
    """Get test user credentials for development"""
    try:
        credentials = db.storage.json.get("test_user_credentials", default=None)
        if not credentials:
            return {"message": "No test credentials found. Create test user first."}
        return credentials
    except Exception as e:
        print(f"Error getting test credentials: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get test credentials")
