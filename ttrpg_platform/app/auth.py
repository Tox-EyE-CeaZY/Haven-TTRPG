from datetime import datetime, timedelta, timezone
from typing import Optional
import os # For environment variables

from fastapi import Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .database import get_db

# Configuration
# It's highly recommended to move SECRET_KEY to an environment variable for production.
# Example: SECRET_KEY = os.getenv("SECRET_KEY", "your_default_secret_key_for_development_only")
SECRET_KEY = os.getenv("SECRET_KEY", "YOUR_VERY_SECRET_KEY_SHOULD_BE_CHANGED_AND_SECURED") # Change this!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REMEMBER_ME_TOKEN_EXPIRE_DAYS = 30 # For "Remember Me" functionality

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/users/token") # Points to your login route

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    # 'nickname' will be part of the 'data' dict passed from the /token endpoint
    # if it exists for the user.
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # Default expiry if none provided (should ideally not be hit if logic is correct)
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def authenticate_user(db: Session, username: str, password: str) -> Optional[models.User]:
    user = crud.get_user_by_username(db, username=username)
    if not user:
        return None
    if not crud.verify_password(password, user.hashed_password): # Assuming verify_password is in crud
        return None
    return user

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        user_id: Optional[int] = payload.get("user_id") # Ensure user_id is also in token
        # nickname: Optional[str] = payload.get("nickname") # Can be retrieved if needed by TokenData
        if username is None or user_id is None: # Nickname can be None, so not checking it here for credentials_exception
            raise credentials_exception
        token_data = schemas.TokenData(username=username, user_id=user_id) # nickname could be added to TokenData if needed elsewhere
    except JWTError:
        raise credentials_exception
    
    # It's generally better to fetch user by ID from token if available and reliable
    user = crud.get_user_by_id(db, user_id=token_data.user_id)
    if user is None or user.username != token_data.username: # Additional check
        raise credentials_exception
    return user

async def get_current_user_from_token_for_ws(
    token: str, # Token will be passed from WebSocket connection
    db: Session # Manually pass db session if needed from WebSocket endpoint
) -> Optional[models.User]:
    """
    Authenticates a user based on a JWT token, intended for WebSocket connections.
    Returns the user model or None if authentication fails.
    Does not raise HTTPException directly as it's for WS.
    """
    if token is None:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        user_id: Optional[int] = payload.get("user_id")
        if username is None or user_id is None:
            return None
    except JWTError:
        return None
    
    user = crud.get_user_by_id(db, user_id=user_id)
    return user # Returns user or None

async def get_current_active_user(current_user: models.User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user
