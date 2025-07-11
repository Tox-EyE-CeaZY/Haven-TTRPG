# e:\Random Stuff\App App\TTRPG Site\ttrpg_platform\app\routers\characters.py
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi.responses import FileResponse # Import FileResponse
from pathlib import Path
import shutil
import time
import os # Import the os module

from .. import schemas, auth, models # models.User
from ..crud_characters import (
    get_user_character_db_session,
    create_roleplay_character,
    get_roleplay_characters_by_user,
    get_roleplay_character_by_id,
    update_roleplay_character,
    delete_roleplay_character,
    set_character_photo_filename,
    create_gallery_image_record,
    get_gallery_images_for_character,
    delete_gallery_image_record
)

router = APIRouter(
    prefix="/api/characters",
    tags=["roleplay-characters"],
    responses={404: {"description": "Not found"}},
)

public_router = APIRouter(
    prefix="/api/public/characters",
    tags=["public-characters"],
    responses={404: {"description": "Not found"}},
)



USER_DATA_DIR = Path("_data") # Consistent with crud_characters
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif"}

def get_db_session_for_user(current_user: models.User = Depends(auth.get_current_active_user)):
    """Dependency to get a DB session for the current user's character data."""
    db = get_user_character_db_session(current_user.id)
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=schemas.RoleplayCharacter, status_code=status.HTTP_201_CREATED)
def create_new_roleplay_character(
    character_in: schemas.RoleplayCharacterCreate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db_session_for_user) # Uses the dynamic session
):
    return create_roleplay_character(db=db, character_data=character_in, user_id=current_user.id)

@router.get("/me", response_model=List[schemas.RoleplayCharacter])
def read_my_roleplay_characters(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db_session_for_user)
):
    characters = get_roleplay_characters_by_user(db=db, user_id=current_user.id, skip=skip, limit=limit)
    return characters

@router.get("/{character_id}", response_model=schemas.RoleplayCharacter)
def read_roleplay_character(
    character_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db_session_for_user)
):
    character = get_roleplay_character_by_id(db=db, character_id=character_id, user_id=current_user.id)
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found or not owned by user")
    return character

@router.put("/{character_id}", response_model=schemas.RoleplayCharacter)
def update_existing_roleplay_character(
    character_id: int,
    character_update: schemas.RoleplayCharacterUpdate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db_session_for_user)
):
    updated_character = update_roleplay_character(db=db, character_id=character_id, character_data=character_update, user_id=current_user.id)
    if updated_character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found or not owned by user")
    return updated_character

@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_roleplay_character(
    character_id: int,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db_session_for_user)
):
    success = delete_roleplay_character(db=db, character_id=character_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found or not owned by user")
    return # No content response

# --- Image Upload Endpoints ---
async def _save_image_generic(
    user_id: int,
    file: UploadFile,
    sub_folder: str = "images", # e.g., "images", "documents/images"
    filename_prefix: str = "img"
) -> str:
    """
    Generic function to save an uploaded file for a user, returning the new filename.
    """
    user_specific_dir = USER_DATA_DIR / str(user_id) / sub_folder
    user_specific_dir.mkdir(parents=True, exist_ok=True)

    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_IMAGE_EXTENSIONS: # Assuming this is for images, could be parameterized
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid file type. Allowed: {ALLOWED_IMAGE_EXTENSIONS}")

    if file.size > 200 * 1024 * 1024: # 200MB limit for gallery, adjust as needed
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (max 200MB)")

    timestamp = int(time.time())
    random_suffix = os.urandom(4).hex() # Add some randomness to filename
    new_filename = f"{filename_prefix}_{timestamp}_{random_suffix}{file_extension}"
    file_path = user_specific_dir / new_filename

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        await file.close()
    return new_filename


async def _save_character_image_and_update_db(user_id: int, character_id: int, photo_type: str, file: UploadFile, db: Session) -> Optional[models.RoleplayCharacter]:
    user_images_dir = USER_DATA_DIR / str(user_id) / "images" # This path is specific to character images
    user_images_dir.mkdir(parents=True, exist_ok=True)

    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid file type. Allowed: {ALLOWED_IMAGE_EXTENSIONS}")
    
    if file.size > 200 * 1024 * 1024: # 200MB limit
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (max 200MB)")

    timestamp = int(time.time())
    # Sanitize photo_type for filename
    safe_photo_type_prefix = "".join(c if c.isalnum() else "_" for c in photo_type)
    new_filename = f"char_{character_id}_{safe_photo_type_prefix}_{timestamp}{file_extension}"
    file_path = user_images_dir / new_filename

    # Deletion of old file is now handled in set_character_photo_filename CRUD
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        await file.close()

    return set_character_photo_filename(db, character_id, user_id, photo_type, new_filename)


@router.post("/{character_id}/profile-photo", response_model=schemas.RoleplayCharacter)
async def upload_character_profile_photo(
    character_id: int,
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db_session_for_user)
):
    character = get_roleplay_character_by_id(db, character_id, current_user.id)
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found or not owned by user")
    
    updated_char = await _save_character_image_and_update_db(current_user.id, character_id, "profile", file, db)
    if not updated_char:
         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not update character photo filename")
    return updated_char

@router.post("/{character_id}/reference-photo", response_model=schemas.RoleplayCharacter)
async def upload_character_reference_photo(
    character_id: int,
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db_session_for_user)
):
    character = get_roleplay_character_by_id(db, character_id, current_user.id)
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found or not owned by user")

    updated_char = await _save_character_image_and_update_db(current_user.id, character_id, "reference", file, db)
    if not updated_char:
         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not update character photo filename")
    return updated_char


@router.get("/images/{user_id_str}/{filename}", response_class=FileResponse)
async def get_character_image(user_id_str: str, filename: str):
    # This serves images from the specific character images folder.
    # For a more generic file server, you might need more path components or a different structure.
    # Basic validation/sanitization (you might want more robust checks)
    if not user_id_str.isdigit() or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid path components")
    
    image_path = USER_DATA_DIR / user_id_str / "images" / filename
    if not image_path.exists() or not image_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character image not found")
    return FileResponse(image_path)

# --- Public Character Endpoints ---
@public_router.get("/{owner_user_id}/{character_id_from_url}", response_model=schemas.RoleplayCharacter)
def read_public_roleplay_character(
    owner_user_id: int,
    character_id_from_url: int,
    # No Depends(auth.get_current_active_user) here for public access
):
    # Get DB session for the owner_user_id
    db = get_user_character_db_session(owner_user_id)
    try:
        # Fetch character using the owner_user_id and character_id_from_url
        character = get_roleplay_character_by_id(db=db, character_id=character_id_from_url, user_id=owner_user_id)
        if character is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
        return character
    finally:
        db.close()

@public_router.get("/{owner_user_id}/{character_id_from_url}/gallery-images", response_model=List[schemas.RoleplayCharacterGalleryImage])
def list_public_character_gallery_images(
    owner_user_id: int,
    character_id_from_url: int,
    # No Depends(auth.get_current_active_user) here for public access
):
    db = get_user_character_db_session(owner_user_id)
    try:
        # Verify character exists and belongs to owner_user_id before fetching gallery
        character = get_roleplay_character_by_id(db=db, character_id=character_id_from_url, user_id=owner_user_id)
        if character is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found, cannot fetch gallery.")
        
        # Fetch gallery images for the specified character and owner
        images = get_gallery_images_for_character(db, character_id=character_id_from_url, user_id=owner_user_id)
        return images
    finally:
        db.close()


# --- Character Gallery Image Endpoints ---

@router.post("/{character_id}/gallery-images", response_model=schemas.RoleplayCharacterGalleryImage, status_code=status.HTTP_201_CREATED)
async def upload_character_gallery_image(
    character_id: int,
    alt_text: Optional[str] = File(None), # Allow alt_text to be sent with the file
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db_session_for_user)
):
    character = get_roleplay_character_by_id(db, character_id, current_user.id)
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found or not owned by user")

    # Use the generic save function
    new_filename = await _save_image_generic(
        user_id=current_user.id,
        file=file,
        sub_folder="images", # Standard character image folder
        filename_prefix=f"char_{character_id}_gallery"
    )

    gallery_image_record = create_gallery_image_record(
        db=db,
        character_id=character_id,
        user_id=current_user.id,
        filename=new_filename,
        alt_text=alt_text
    )
    return gallery_image_record

@router.get("/{character_id}/gallery-images", response_model=List[schemas.RoleplayCharacterGalleryImage])
def list_character_gallery_images(
    character_id: int,
    current_user: models.User = Depends(auth.get_current_active_user), # Ensures only owner can list (for now)
    db: Session = Depends(get_db_session_for_user)
):
    # Could add public viewing later if needed, by not requiring current_user for GET
    images = get_gallery_images_for_character(db, character_id=character_id, user_id=current_user.id)
    return images

@router.delete("/{character_id}/gallery-images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_character_gallery_image(
    image_id: int, # This is the ID of the gallery image record, not character_id
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db_session_for_user)
):
    success = delete_gallery_image_record(db, gallery_image_id=image_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gallery image not found or not owned by user")
    return

# TODO: Implement /api/characters/{character_id}/transfer (complex)
# This would involve:
# - Authenticating the current user as the owner.
# - Specifying the target user (e.g., by username or ID in request body).
# - Verifying the target user exists.
# - Potentially a notification/acceptance flow for the target user.
# - Moving the character data from sender's DB to receiver's DB.
# - Moving associated image files.
# - Deleting from sender's DB.
