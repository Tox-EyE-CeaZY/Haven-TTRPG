# e:\Random Stuff\App App\TTRPG Site\ttrpg_platform\app\crud_characters.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from pathlib import Path
from typing import List, Optional
import os

from . import models, schemas # models.RoleplayCharacterBase, models.RoleplayCharacter

# Base directory for user-specific data
USER_DATA_DIR = Path("_data")

def get_user_character_db_session(user_id: int) -> Session:
    """
    Creates and returns a SQLAlchemy session for a specific user's character database.
    Ensures the database and tables exist.
    """
    user_dir = USER_DATA_DIR / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True) # Ensure user's data directory exists

    db_path = user_dir / "characters.db"
    database_url = f"sqlite:///{db_path.resolve()}"

    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    
    # Create tables for RoleplayCharacter model in this specific database if they don't exist
    models.RoleplayCharacterBase.metadata.create_all(bind=engine) 
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    return db

# --- CRUD Operations for Roleplay Characters ---

def create_roleplay_character(db: Session, character_data: schemas.RoleplayCharacterCreate, user_id: int) -> models.RoleplayCharacter:
    db_character = models.RoleplayCharacter(
        **character_data.model_dump(),
        user_id=user_id # Explicitly set user_id
    )
    db.add(db_character)
    db.commit()
    db.refresh(db_character)
    return db_character

def get_roleplay_characters_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[models.RoleplayCharacter]:
    # Since this db session is already for the specific user,
    # the user_id filter on the query is mostly for completeness if the model has user_id.
    return db.query(models.RoleplayCharacter).filter(models.RoleplayCharacter.user_id == user_id).offset(skip).limit(limit).all()

def get_roleplay_character_by_id(db: Session, character_id: int, user_id: int) -> Optional[models.RoleplayCharacter]:
    return db.query(models.RoleplayCharacter).filter(models.RoleplayCharacter.id == character_id, models.RoleplayCharacter.user_id == user_id).first()

def update_roleplay_character(db: Session, character_id: int, character_data: schemas.RoleplayCharacterUpdate, user_id: int) -> Optional[models.RoleplayCharacter]:
    db_character = get_roleplay_character_by_id(db, character_id=character_id, user_id=user_id)
    if not db_character:
        return None
    
    update_data = character_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_character, key, value)
    
    db.commit()
    db.refresh(db_character)
    return db_character

def delete_roleplay_character(db: Session, character_id: int, user_id: int) -> bool:
    db_character = get_roleplay_character_by_id(db, character_id=character_id, user_id=user_id)
    if not db_character:
        return False

    # Delete associated image files
    user_image_dir = USER_DATA_DIR / str(user_id) / "images"
    if db_character.profile_photo_filename:
        (user_image_dir / db_character.profile_photo_filename).unlink(missing_ok=True)
    if db_character.reference_photo_filename:
        (user_image_dir / db_character.reference_photo_filename).unlink(missing_ok=True)

    # Delete gallery images and their files
    gallery_images = get_gallery_images_for_character(db, character_id=character_id, user_id=user_id)
    for img in gallery_images:
        (user_image_dir / img.filename).unlink(missing_ok=True)
        # The DB record for gallery image will be deleted by CASCADE if DB supports it,
        # or we'd delete them explicitly here before deleting the character.
        # Since we have ondelete="CASCADE", we assume DB handles it.

    db.delete(db_character)
    db.commit()
    return True

def set_character_photo_filename(db: Session, character_id: int, user_id: int, photo_type: str, filename: Optional[str]) -> Optional[models.RoleplayCharacter]:
    db_character = get_roleplay_character_by_id(db, character_id=character_id, user_id=user_id)
    if not db_character:
        return None

    user_image_dir = USER_DATA_DIR / str(user_id) / "images"

    if photo_type == "profile":
        # Delete old profile photo if it exists and filename is changing to a new one
        if db_character.profile_photo_filename and db_character.profile_photo_filename != filename:
            (user_image_dir / db_character.profile_photo_filename).unlink(missing_ok=True)
        db_character.profile_photo_filename = filename
    elif photo_type == "reference":
        # Delete old reference photo if it exists and filename is changing to a new one
        if db_character.reference_photo_filename and db_character.reference_photo_filename != filename:
            (user_image_dir / db_character.reference_photo_filename).unlink(missing_ok=True)
        db_character.reference_photo_filename = filename
    else:
        return None # Invalid photo type
        
    db.commit()
    db.refresh(db_character)
    return db_character

# Placeholder for transfer - this is complex and needs more thought on security and acceptance flow
def transfer_character_ownership(db_sender: Session, db_receiver: Session, character_id: int, sender_user_id: int, receiver_user_id: int) -> bool:
    # 1. Get character from sender's DB
    # 2. Create character in receiver's DB (copy data)
    # 3. Delete character from sender's DB
    # This is a simplified concept. Real transfer might involve notifications, acceptance, etc.
    # Also, image files would need to be moved/copied.
    print(f"Transfer requested for char {character_id} from user {sender_user_id} to {receiver_user_id}")
    # This is a stub and needs full implementation.
    return False

# --- CRUD Operations for Roleplay Character Gallery Images ---

def create_gallery_image_record(db: Session, character_id: int, user_id: int, filename: str, alt_text: Optional[str] = None) -> models.RoleplayCharacterGalleryImage:
    db_gallery_image = models.RoleplayCharacterGalleryImage(
        character_id=character_id,
        user_id=user_id,
        filename=filename,
        alt_text=alt_text
    )
    db.add(db_gallery_image)
    db.commit()
    db.refresh(db_gallery_image)
    return db_gallery_image

def get_gallery_images_for_character(db: Session, character_id: int, user_id: int, skip: int = 0, limit: int = 100) -> List[models.RoleplayCharacterGalleryImage]:
    return db.query(models.RoleplayCharacterGalleryImage)\
        .filter(models.RoleplayCharacterGalleryImage.character_id == character_id, models.RoleplayCharacterGalleryImage.user_id == user_id)\
        .order_by(models.RoleplayCharacterGalleryImage.uploaded_at.asc())\
        .offset(skip).limit(limit).all()

def delete_gallery_image_record(db: Session, gallery_image_id: int, user_id: int) -> bool:
    db_gallery_image = db.query(models.RoleplayCharacterGalleryImage)\
        .filter(models.RoleplayCharacterGalleryImage.id == gallery_image_id, models.RoleplayCharacterGalleryImage.user_id == user_id).first()
    if not db_gallery_image:
        return False
    
    (USER_DATA_DIR / str(user_id) / "images" / db_gallery_image.filename).unlink(missing_ok=True)
    db.delete(db_gallery_image)
    db.commit()
    return True
