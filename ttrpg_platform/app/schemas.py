from pydantic import BaseModel, EmailStr, computed_field, Field, field_validator
from typing import List, Optional, Dict
from pydantic.fields import AliasPath # Add AliasPath
from datetime import datetime # Keep this import


# User Schemas
class UserBase(BaseModel):
    username: str
    nickname: Optional[str] = None
    email: EmailStr
    bio: Optional[str] = None
    # avatar_url will be a computed field in User schema
    social_links: Optional[Dict[str, str]] = None

class UserCreate(UserBase):
    # nickname is inherited from UserBase and can be optionally provided
    password: str

class User(UserBase): # This schema is used for returning user details
    id: int
    is_active: bool
    is_admin: bool
    email_notifications_enabled: bool = True
    avatar_filename: Optional[str] = None # Expose filename for potential direct use if needed
    # bio, avatar_url, social_links are inherited from UserBase

    class Config:
        from_attributes = True # Pydantic V2

    @computed_field # Pydantic V2
    @property
    def avatar_url(self) -> Optional[str]:
        if self.avatar_filename:
            return f"/api/users/avatars/{self.id}" # This will be the endpoint to serve the avatar
        return None

# Public User Profile Schema
class UserPublicProfileBase(BaseModel):
    username: str
    nickname: Optional[str] = None
    bio: Optional[str] = None
    social_links: Optional[Dict[str, str]] = None
    # Needed for the avatar_url computed field
    id: int
    avatar_filename: Optional[str] = None

class UserPublicProfile(UserPublicProfileBase):
    class Config:
        from_attributes = True

    @computed_field
    @property
    def avatar_url(self) -> Optional[str]: # Re-define or ensure it's inherited and works
        if self.avatar_filename:
            return f"/api/users/avatars/{self.id}"
        return None

# Token Schemas (for authentication)
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None # Added for storing user_id in token

# User Profile Update Schema
class UserProfileUpdate(BaseModel):
    nickname: Optional[str] = None
    bio: Optional[str] = None
    # avatar_url is removed, will be handled by a separate endpoint
    email_notifications_enabled: Optional[bool] = None
    social_links: Optional[Dict[str, str]] = None

# Game Schemas
class GameBase(BaseModel):
    name: str
    description: Optional[str] = None
    max_players: Optional[int] = None

class GameCreate(GameBase):
    pass

class Game(GameBase):
    id: int
    master_id: int
    is_active: bool

    class Config:
        from_attributes = True

# Notification Schemas
class NotificationBase(BaseModel):
    type: str
    content: str
    link: Optional[str] = None

class NotificationCreate(NotificationBase):
    user_id: int # Recipient user ID

class Notification(NotificationBase):
    id: int
    user_id: int
    is_read: bool
    timestamp: datetime
    # We might not need to return the full user object with each notification,
    # as notifications are typically fetched for the 'current_user'.
    # If needed, add: user: User

    class Config:
        from_attributes = True

class GameDetails(Game):
    master: User
    players: List[User] = []

    class Config:
        from_attributes = True

# Game Message Schemas
class GameMessageBase(BaseModel):
    content: str
    # Fields for RP chat style
    sender_display_name: Optional[str] = None
    sender_role: Optional[str] = None # E.g., 'gm', 'character', 'system', 'action'
    sender_avatar_url: Optional[str] = None

class GameMessageCreate(GameMessageBase):
    # sender_id will be passed to CRUD if applicable
    # game_id will be passed to CRUD
    pass

class GameMessage(GameMessageBase):
    id: int
    game_id: int
    sender_id: Optional[int] = None # Made nullable
    timestamp: datetime
    sender: Optional[User] = None # Sender can be null if it's a system/GM message not tied to a user

    class Config:
        from_attributes = True

# Direct Message Schemas
class DirectMessageBase(BaseModel):
    content: str

class DirectMessageCreate(DirectMessageBase):
    pass

class DirectMessage(DirectMessageBase):
    id: int
    sender_id: int
    receiver_id: int
    timestamp: datetime
    is_read: bool = False
    sender: User
    receiver: User

    class Config:
        from_attributes = True

# --- RP Chat Specific Schemas (mirroring frontend's MockMessage) ---
class RpChatMessageCreate(BaseModel):
    # Use Field aliases to map from SQLAlchemy model attributes
    senderName: str = Field(validation_alias=AliasPath("sender_display_name"))
    senderType: str = Field(validation_alias=AliasPath("sender_role")) # gm, character, system, narration, action
    content: str
    avatar: Optional[str] = Field(default=None, validation_alias=AliasPath("sender_avatar_url"))
    character_id: Optional[str] = Field(default=None) # Add character_id
    owner_user_id: Optional[str] = Field(default=None) # Add owner_user_id
    # timestamp will be generated by backend

    class Config: # Add Config class
        from_attributes = True
        populate_by_name = True # Allow using field names as well as aliases

class RpChatMessageResponse(RpChatMessageCreate):
    id: str # Keep as string, will be converted
    timestamp: str # Keep as string, will be converted
    # Inherits Config from RpChatMessageCreate, or you can redefine it:
    # class Config:
    #     from_attributes = True
    #     populate_by_name = True

    _validate_id = field_validator('id', mode='before')(lambda v: str(v) if isinstance(v, int) else v)
    _validate_timestamp = field_validator('timestamp', mode='before')(lambda v: v.isoformat() if isinstance(v, datetime) else v)



# Conversation Schema (for listing conversations)
class Conversation(BaseModel):
    other_user: User
    last_message: Optional[DirectMessage] = None
    unread_count: int = 0

    class Config:
        from_attributes = True


# --- Roleplay Character Schemas ---
class RoleplayCharacterBase(BaseModel):
    name: str
    nickname: Optional[str] = None
    description: Optional[str] = None
    # profile_photo_filename: Optional[str] = None # Handled by upload endpoint
    # reference_photo_filename: Optional[str] = None # Handled by upload endpoint
    design: Optional[str] = None
    abilities: Optional[str] = None
    lore: Optional[str] = None
    birthday: Optional[str] = None
    interests: Optional[str] = None
    disinterests: Optional[str] = None
    home_world: Optional[str] = None
    universe: Optional[str] = None
    time_period: Optional[str] = None
    main_weapon: Optional[str] = None
    armor_attire: Optional[str] = None
    key_items: Optional[str] = None
    general_inventory: Optional[str] = None

class RoleplayCharacterCreate(RoleplayCharacterBase):
    pass # All fields are in base for now

class RoleplayCharacterUpdate(RoleplayCharacterBase):
    name: Optional[str] = None # Allow updating name
    # All other fields are already optional in base

class RoleplayCharacter(RoleplayCharacterBase):
    id: int
    user_id: int # To confirm ownership
    profile_photo_filename: Optional[str] = None
    reference_photo_filename: Optional[str] = None
    timestamp_created: datetime
    timestamp_updated: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Roleplay Character Gallery Image Schemas ---
class RoleplayCharacterGalleryImageBase(BaseModel):
    alt_text: Optional[str] = None
    # filename is handled by upload logic

class RoleplayCharacterGalleryImageCreate(RoleplayCharacterGalleryImageBase):
    filename: str # Required when creating the DB record

class RoleplayCharacterGalleryImage(RoleplayCharacterGalleryImageBase):
    id: int
    character_id: int
    user_id: int
    filename: str
    uploaded_at: datetime

    class Config:
        from_attributes = True
