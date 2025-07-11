from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Table, DateTime, JSON
from sqlalchemy.orm import relationship, Mapped, mapped_column
from typing import Optional # Add this import
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base

from .database import Base # This is for the main application database

# Association table for the many-to-many relationship between users (players) and games
user_games_association = Table(
    "user_games", Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("game_id", Integer, ForeignKey("games.id"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    nickname: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True) # Added nickname
    bio: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    avatar_filename: Mapped[Optional[str]] = mapped_column(String, nullable=True) # Changed from avatar_url
    social_links = Column(JSON, nullable=True) # For storing e.g. {"twitter": "url", "website": "url"}
    is_admin = Column(Boolean, default=False) # For your admin panel
    email_notifications_enabled = Column(Boolean, default=True) # New field for email notifications
    last_digest_sent_at = Column(DateTime(timezone=True), nullable=True) # For digest tracking

    # Relationship to games this user has created (as master)
    games_mastered = relationship("Game", back_populates="master")

    # Relationship to games this user has joined (as player)
    games_joined = relationship("Game", secondary=user_games_association, back_populates="players")

    # Relationships for direct messages
    sent_direct_messages = relationship("DirectMessage", foreign_keys="[DirectMessage.sender_id]", back_populates="sender")
    received_direct_messages = relationship("DirectMessage", foreign_keys="[DirectMessage.receiver_id]", back_populates="receiver")


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    master_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    max_players = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)

    players = relationship("User", secondary=user_games_association, back_populates="games_joined")
    master = relationship("User", back_populates="games_mastered")


class GameMessage(Base):
    __tablename__ = "game_messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Made nullable

        # New fields for RP chat style messages
    sender_display_name = Column(String, nullable=True)
    sender_role = Column(String, nullable=True) # E.g., 'gm', 'character', 'system', 'action'
    sender_avatar_url = Column(String, nullable=True)
    character_id = Column(String, nullable=True) # Store as string, matching frontend's MockMessage
    owner_user_id = Column(String, nullable=True) # Store as string
    
    game = relationship("Game")
    sender = relationship("User")


class DirectMessage(Base):
    __tablename__ = "direct_messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_read = Column(Boolean, default=False)

    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_direct_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_direct_messages")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # The recipient of the notification
    type = Column(String, nullable=False)  # e.g., "new_dm", "game_invite", "game_update"
    content = Column(String, nullable=False)  # The text of the notification
    link = Column(String, nullable=True)  # Optional link to navigate to (e.g., /dm/username or /games/id)
    is_read = Column(Boolean, default=False, index=True)
    emailed_in_digest = Column(Boolean, default=False, index=True) # New field for digest tracking
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User") # Relationship to the user who owns this notification

    def __repr__(self):
        return f"<Notification id={self.id} user_id={self.user_id} type='{self.type}' is_read={self.is_read}>"


# Separate Base for Roleplay Characters in their own per-user databases
RoleplayCharacterBase = declarative_base()

class RoleplayCharacter(RoleplayCharacterBase):
    __tablename__ = "roleplay_characters"

    id = Column(Integer, primary_key=True, index=True)
    # user_id is implicit by the database file, but good to store for potential future merging/queries
    # For simplicity in this per-user DB model, we might not strictly need it as a column here
    # if all characters in this DB belong to that user. However, let's keep it for robustness.
    user_id = Column(Integer, nullable=False, index=True) 

    name = Column(String, nullable=False, index=True)
    nickname = Column(String, nullable=True)
    description = Column(String, nullable=True)
    profile_photo_filename = Column(String, nullable=True)
    reference_photo_filename = Column(String, nullable=True)
    design = Column(String, nullable=True) # Could be very long, consider Text type if DB supports it well
    abilities = Column(String, nullable=True)
    lore = Column(String, nullable=True) # Could be very long
    birthday = Column(String, nullable=True)
    interests = Column(String, nullable=True)
    disinterests = Column(String, nullable=True)
    home_world = Column(String, nullable=True)
    universe = Column(String, nullable=True)
    time_period = Column(String, nullable=True)
    main_weapon = Column(String, nullable=True)
    armor_attire = Column(String, nullable=True)
    key_items = Column(String, nullable=True)
    general_inventory = Column(String, nullable=True)

    timestamp_created = Column(DateTime(timezone=True), server_default=func.now())
    timestamp_updated = Column(DateTime(timezone=True), onupdate=func.now())


class RoleplayCharacterGalleryImage(RoleplayCharacterBase):
    __tablename__ = "roleplay_character_gallery_images"

    id = Column(Integer, primary_key=True, index=True)
    character_id = Column(Integer, ForeignKey("roleplay_characters.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True) # Owner of the character/image
    filename = Column(String, nullable=False)
    alt_text = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    character = relationship("RoleplayCharacter") # Relationship back to the character


class DmNotificationCooldown(Base):
    __tablename__ = "dm_notification_cooldowns"

    id = Column(Integer, primary_key=True, index=True)
    # The user who sent the DM that triggered the last email
    original_sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # The user who received the DM and the email notification
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    last_email_sent_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
