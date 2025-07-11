from fastapi import APIRouter, Depends, HTTPException, status, Form, Query, File, UploadFile
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List
import os
import shutil
from pathlib import Path
import time # For unique filenames

from .. import crud, schemas, auth, models
from ..database import get_db

router = APIRouter(
    prefix="/api/users",
    tags=["users"],
    responses={404: {"description": "Not found"}},
)

AVATAR_DIR = Path("_data") / "avatars"
ALLOWED_AVATAR_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif"}

@router.post("/register", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user_by_email = crud.get_user_by_email(db, email=user.email)
    if db_user_by_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    db_user_by_username = crud.get_user_by_username(db, username=user.username)
    if db_user_by_username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
    return crud.create_user(db=db, user=user)

@router.post("/token", response_model=schemas.Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = Form(False), # Add remember_me field from form
    db: Session = Depends(get_db)
):
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if remember_me:
        access_token_expires = timedelta(days=auth.REMEMBER_ME_TOKEN_EXPIRE_DAYS)
    else:
        access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
        
    access_token = auth.create_access_token(
        data={
            "sub": user.username, 
            "user_id": user.id, 
            "nickname": user.nickname  # Add nickname to the token payload
        }, 
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(auth.get_current_active_user)):
    return current_user

@router.put("/me/profile", response_model=schemas.User)
async def update_my_profile(
    profile_update: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    updated_user = crud.update_user_profile(db, user_id=current_user.id, profile_data=profile_update)
    if not updated_user:
        # This case should ideally not be hit if current_user is valid
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return updated_user

@router.put("/me/settings", response_model=schemas.User) # Changed from /me/profile to /me/settings for clarity
async def update_my_settings( # Renamed function for clarity
    settings_update: schemas.UserProfileUpdate, # Using UserProfileUpdate as it now contains email_notifications_enabled
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Update settings for the current user.
    This can include nickname, bio, social_links, and email_notifications_enabled.
    """
    update_data = settings_update.model_dump(exclude_unset=True)

    if not update_data: # No actual data sent to update
        return current_user

    # The crud.update_user_profile should handle setting attributes based on UserProfileUpdate
    updated_user = crud.update_user_profile(db, user_id=current_user.id, profile_data=settings_update)
    
    if not updated_user:
        # This case should ideally not be hit if current_user is valid
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found during settings update")
    return updated_user

@router.post("/me/avatar", response_model=schemas.User)
async def upload_my_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    # Ensure avatar directory exists
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)

    # Validate file type
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_AVATAR_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types are: {', '.join(ALLOWED_AVATAR_EXTENSIONS)}"
        )

    # Validate file size (e.g., max 2MB)
    if file.size > 2 * 1024 * 1024: # 2MB
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 2MB."
        )

    # Generate a unique filename
    timestamp = int(time.time())
    new_filename = f"user_{current_user.id}_{timestamp}{file_extension}"
    file_path = AVATAR_DIR / new_filename

    # Delete old avatar if it exists
    if current_user.avatar_filename:
        old_avatar_path = AVATAR_DIR / current_user.avatar_filename
        if old_avatar_path.exists():
            old_avatar_path.unlink()

    # Save the new file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        await file.close() # Ensure the file is closed

    # Update user's avatar filename in DB
    updated_user = crud.set_user_avatar_filename(db, user_id=current_user.id, filename=new_filename)
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not update avatar information")
    
    return updated_user

@router.get("/avatars/{user_id}", response_class=FileResponse)
async def get_user_avatar(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user_by_id(db, user_id=user_id)
    if not user or not user.avatar_filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")
    
    avatar_path = AVATAR_DIR / user.avatar_filename
    if not avatar_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar file not found on server")
    return FileResponse(avatar_path)

@router.get("/profile/{username}", response_model=schemas.UserPublicProfile)
async def read_user_public_profile(
    username: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve a user's public profile information by username.
    This endpoint does not require authentication.
    """
    db_user = crud.get_user_by_username(db, username=username)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{username}' not found")
    return db_user # Pydantic will convert models.User to schemas.UserPublicProfile

@router.get("/search", response_model=schemas.User)
async def search_user_by_username(
    username: str = Query(..., min_length=1, description="Exact username to search for"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user) # Protect endpoint
):
    """
    Search for a user by their exact username.
    Returns the user details if found. Requires authentication to use.
    """
    db_user = crud.get_user_by_username(db, username=username)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{username}' not found")
    return db_user

@router.get("/admin/users", response_model=List[schemas.User])
async def read_all_users_admin(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this action")
    users = crud.get_users(db, skip=0, limit=1000) # Example: get all users, adjust as needed
    return users

@router.get("/me/joined-games", response_model=List[schemas.GameDetails])
async def read_my_joined_games(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Retrieve a list of games the current logged-in user has joined.
    Supports pagination.
    """
    return crud.get_games_joined_by_user_id(db, user_id=current_user.id, skip=skip, limit=limit)
