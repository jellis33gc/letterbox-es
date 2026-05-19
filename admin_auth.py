from app.auth import AuthorizedUser
from app.auth.user import get_authorized_user
from fastapi import Depends, HTTPException
from typing import Annotated

# Hardcoded admin emails
ADMIN_EMAILS = ["info@letterbox.es", "admin@letterbox.es"]

async def get_current_admin(user: Annotated[AuthorizedUser, Depends(get_authorized_user)]):
    """
    Dependency to ensure the current user is an admin.
    Returns the AuthorizedUser if they are an admin, otherwise raises 403.
    """
    if user.email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Not authorized as admin")
    return user
