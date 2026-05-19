from fastapi import APIRouter, HTTPException
from datetime import datetime
import databutton as db
import re

router = APIRouter(prefix="/test")

def sanitize_storage_key(key: str) -> str:
    """Sanitize storage key to only allow alphanumeric and ._- symbols"""
    return re.sub(r'[^a-zA-Z0-9._-]', '', key)

def get_customer_mail_key(customer_email: str) -> str:
    """Generate storage key for customer mail data"""
    return sanitize_storage_key(f"customer_mail_{customer_email}")

@router.post("/create-sample-data")
async def create_sample_data(customer_email: str = "test@letterbox.es"):
    """Create sample mail data for testing"""
    try:
        # Sample mail items
        sample_items = [
            {
                'id': sanitize_storage_key(f"mail_{customer_email}_20250605001"),
                'customer_email': customer_email,
                'sender': 'HMRC Tax Office',
                'date': '2025-06-05',
                'status': 'new',
                'priority': 'urgent',
                'envelope_preview_url': 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=300&fit=crop',
                'subscription_plan': 'receive-and-scan',
                'actions': [],
                'created_at': datetime.now().isoformat()
            },
            {
                'id': sanitize_storage_key(f"mail_{customer_email}_20250604002"),
                'customer_email': customer_email,
                'sender': 'Bank of England',
                'date': '2025-06-04',
                'status': 'new',
                'priority': 'normal',
                'envelope_preview_url': 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&h=300&fit=crop',
                'subscription_plan': 'receive-and-forward',
                'actions': [],
                'created_at': datetime.now().isoformat()
            },
            {
                'id': sanitize_storage_key(f"mail_{customer_email}_20250603003"),
                'customer_email': customer_email,
                'sender': 'Royal Mail',
                'date': '2025-06-03',
                'status': 'pending',
                'priority': 'normal',
                'envelope_preview_url': 'https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=400&h=300&fit=crop',
                'subscription_plan': 'receive-only',
                'actions': [
                    {
                        'id': 'action_001',
                        'type': 'hold',
                        'timestamp': datetime.now().isoformat(),
                        'notes': None,
                        'status': 'pending'
                    }
                ],
                'created_at': datetime.now().isoformat()
            }
        ]
        
        # Store the sample data
        customer_mail_key = get_customer_mail_key(customer_email)
        db.storage.json.put(customer_mail_key, sample_items)
        
        return {
            'success': True,
            'message': f'Created {len(sample_items)} sample mail items for {customer_email}',
            'items_created': len(sample_items)
        }
        
    except Exception as e:
        print(f"Error creating sample data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create sample data")

@router.delete("/clear-data")
async def clear_test_data(customer_email: str = "test@letterbox.es"):
    """Clear test data for a customer"""
    try:
        customer_mail_key = get_customer_mail_key(customer_email)
        db.storage.json.put(customer_mail_key, [])
        
        return {
            'success': True,
            'message': f'Cleared test data for {customer_email}'
        }
        
    except Exception as e:
        print(f"Error clearing test data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to clear test data")
