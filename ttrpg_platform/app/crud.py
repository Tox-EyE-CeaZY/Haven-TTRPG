from sqlalchemy.orm import Session, joinedload
from . import models, schemas
from typing import Optional, List
from sqlalchemy import or_, and_, desc, func, case
from datetime import datetime
from passlib.context import CryptContext
import re 
import random

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = pwd_context.hash(user.password)
    db_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        nickname=user.nickname,
        bio=user.bio,
        social_links=user.social_links
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def update_user_profile(db: Session, user_id: int, profile_data: schemas.UserProfileUpdate) -> Optional[models.User]:
    db_user = get_user_by_id(db, user_id=user_id)
    if not db_user:
        return None

    update_data = profile_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        if hasattr(db_user, key):
            setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user

def set_user_avatar_filename(db: Session, user_id: int, filename: Optional[str]) -> Optional[models.User]:
    db_user = get_user_by_id(db, user_id=user_id)
    if not db_user:
        return None
    
    db_user.avatar_filename = filename
    db.commit()
    db.refresh(db_user)
    return db_user

# Game CRUD operations
def create_game(db: Session, game: schemas.GameCreate, master_id: int):
    db_game = models.Game(**game.model_dump(), master_id=master_id)
    db.add(db_game)
    db.commit()
    db.refresh(db_game)
    return db_game

def get_game_by_id(db: Session, game_id: int):
    return db.query(models.Game).options(
        joinedload(models.Game.master),
        joinedload(models.Game.players)
    ).filter(models.Game.id == game_id).first()

def get_games(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Game).options(
        joinedload(models.Game.master),
        joinedload(models.Game.players)
    ).offset(skip).limit(limit).all()

def add_player_to_game(db: Session, game: models.Game, user: models.User):
    game.players.append(user)
    db.commit()
    db.refresh(game)
    return game

def remove_player_from_game(db: Session, game: models.Game, user: models.User):
    if user in game.players:
        game.players.remove(user)
        db.commit()
        db.refresh(game)
    return game

def get_games_by_master_id(db: Session, master_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Game).options(joinedload(models.Game.master), joinedload(models.Game.players))\
        .filter(models.Game.master_id == master_id).offset(skip).limit(limit).all()

def get_games_joined_by_user_id(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Game)\
        .join(models.user_games_association, models.user_games_association.c.game_id == models.Game.id)\
        .filter(models.user_games_association.c.user_id == user_id)\
        .options(joinedload(models.Game.master), joinedload(models.Game.players))\
        .offset(skip).limit(limit).all()

# Game Message CRUD operations (Original - for standard game messages)
def create_game_message(db: Session, message_create: schemas.GameMessageCreate, game_id: int, sender_id: Optional[int]): # Modified to accept Optional[int] for sender_id
    db_message = models.GameMessage(
        content=message_create.content,
        game_id=game_id,
        sender_id=sender_id, # This will be the actual user ID if provided
        sender_display_name=message_create.sender_display_name, # From RP style
        sender_role=message_create.sender_role,                 # From RP style
        sender_avatar_url=message_create.sender_avatar_url      # From RP style
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db.query(models.GameMessage).options(joinedload(models.GameMessage.sender)).filter(models.GameMessage.id == db_message.id).first()

def get_game_messages(db: Session, game_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.GameMessage)\
        .options(joinedload(models.GameMessage.sender)) \
        .filter(models.GameMessage.game_id == game_id) \
        .order_by(models.GameMessage.timestamp.asc()) \
        .offset(skip).limit(limit).all()

# Direct Message CRUD operations
def create_direct_message(db: Session, message_create: schemas.DirectMessageCreate, sender_id: int, receiver_id: int):
    db_message = models.DirectMessage(
        content=message_create.content,
        sender_id=sender_id,
        receiver_id=receiver_id
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db.query(models.DirectMessage).options(
        joinedload(models.DirectMessage.sender),
        joinedload(models.DirectMessage.receiver)
    ).filter(models.DirectMessage.id == db_message.id).first()

def get_direct_messages_between_users(db: Session, user1_id: int, user2_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.DirectMessage)\
        .options(joinedload(models.DirectMessage.sender), joinedload(models.DirectMessage.receiver))\
        .filter(
            or_(
                and_(models.DirectMessage.sender_id == user1_id, models.DirectMessage.receiver_id == user2_id),
                and_(models.DirectMessage.sender_id == user2_id, models.DirectMessage.receiver_id == user1_id)
            )
        )\
        .order_by(models.DirectMessage.timestamp.asc())\
        .offset(skip).limit(limit).all()

def get_user_conversations(db: Session, user_id: int):
    latest_message_subquery = db.query(
            func.max(models.DirectMessage.id).label("max_id")
        ).filter(
            or_(models.DirectMessage.sender_id == user_id, models.DirectMessage.receiver_id == user_id)
        ).group_by(
            case((models.DirectMessage.sender_id == user_id, models.DirectMessage.receiver_id),
                 else_ = models.DirectMessage.sender_id)
        ).subquery()

    conversations = db.query(models.DirectMessage)\
        .options(joinedload(models.DirectMessage.sender), joinedload(models.DirectMessage.receiver))\
        .filter(models.DirectMessage.id.in_(db.query(latest_message_subquery.c.max_id)))\
        .order_by(models.DirectMessage.timestamp.desc()).all()
    return conversations

# Notification CRUD operations
def create_notification(db: Session, notification: schemas.NotificationCreate) -> models.Notification:
    db_notification = models.Notification(
        user_id=notification.user_id,
        type=notification.type,
        content=notification.content,
        link=notification.link
    )
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    return db_notification

def get_notifications_for_user(db: Session, user_id: int, skip: int = 0, limit: int = 20, include_read: bool = False) -> List[models.Notification]:
    query = db.query(models.Notification).filter(models.Notification.user_id == user_id)
    if not include_read:
        query = query.filter(models.Notification.is_read == False)
    
    return query.order_by(models.Notification.timestamp.desc()).offset(skip).limit(limit).all()

def mark_notification_as_read(db: Session, notification_id: int, user_id: int) -> Optional[models.Notification]:
    db_notification = db.query(models.Notification).filter(models.Notification.id == notification_id, models.Notification.user_id == user_id).first()
    if db_notification:
        db_notification.is_read = True
        db.commit()
        db.refresh(db_notification)
    return db_notification

def mark_all_notifications_as_read_for_user(db: Session, user_id: int) -> int:
    updated_count = db.query(models.Notification)\
        .filter(models.Notification.user_id == user_id, models.Notification.is_read == False)\
        .update({models.Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return updated_count

def update_user_last_digest_sent_time(db: Session, user_id: int) -> Optional[models.User]:
    user = get_user_by_id(db, user_id=user_id)
    if user:
        user.last_digest_sent_at = func.now()
        db.commit()
        db.refresh(user)
    return user

def get_notifications_for_digest(
    db: Session, 
    user_id: int, 
    since: Optional[datetime] = None,
    excluded_types: Optional[List[str]] = None,
    included_types: Optional[List[str]] = None
) -> List[models.Notification]:
    query = db.query(models.Notification).filter(models.Notification.user_id == user_id)
    query = query.filter(models.Notification.emailed_in_digest == False)
    
    if excluded_types:
        query = query.filter(models.Notification.type.notin_(excluded_types))
    if included_types:
        query = query.filter(models.Notification.type.in_(included_types))
    if since:
        query = query.filter(models.Notification.timestamp > since)

    return query.order_by(models.Notification.timestamp.asc()).all()

def mark_notifications_as_emailed_in_digest(db: Session, notification_ids: List[int]) -> int:
    if not notification_ids:
        return 0
    updated_count = db.query(models.Notification)\
        .filter(models.Notification.id.in_(notification_ids))\
        .update({models.Notification.emailed_in_digest: True}, synchronize_session=False)
    db.commit()
    return updated_count

def get_dm_notification_cooldown(db: Session, original_sender_id: int, receiver_id: int) -> Optional[models.DmNotificationCooldown]:
    return db.query(models.DmNotificationCooldown)\
        .filter(models.DmNotificationCooldown.original_sender_id == original_sender_id,
                models.DmNotificationCooldown.receiver_id == receiver_id)\
        .first()

def upsert_dm_notification_cooldown(db: Session, original_sender_id: int, receiver_id: int) -> models.DmNotificationCooldown:
    cooldown_record = get_dm_notification_cooldown(db, original_sender_id, receiver_id)
    if cooldown_record:
        cooldown_record.last_email_sent_at = func.now()
    else:
        cooldown_record = models.DmNotificationCooldown(original_sender_id=original_sender_id, receiver_id=receiver_id)
        db.add(cooldown_record)
    db.commit()
    db.refresh(cooldown_record)
    return cooldown_record

# --- RP Chat Style Game Messages ---
def create_game_message_rp_style(
    db: Session, 
    game_id: int, 
    message_data: schemas.GameMessageCreate, 
    sender_id: Optional[int] = None
):
    db_message = models.GameMessage(
        content=message_data.content,
        game_id=game_id,
        sender_id=sender_id, 
        sender_display_name=message_data.senderName, # Use the Pydantic model's field name
        sender_role=message_data.senderType,       # Use the Pydantic model's field name
        sender_avatar_url=message_data.avatar,       # Use the Pydantic model's field name
        character_id=message_data.character_id if hasattr(message_data, 'character_id') else None,
        owner_user_id=message_data.owner_user_id if hasattr(message_data, 'owner_user_id') else None,
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    query = db.query(models.GameMessage)
    if sender_id:
        query = query.options(joinedload(models.GameMessage.sender))
    
    return query.filter(models.GameMessage.id == db_message.id).first()

def get_game_messages_rp_style(db: Session, game_id: int, skip: int = 0, limit: int = 100) -> List[models.GameMessage]:
    return db.query(models.GameMessage)\
        .options(joinedload(models.GameMessage.sender)) \
        .filter(models.GameMessage.game_id == game_id) \
        .order_by(models.GameMessage.timestamp.asc()) \
        .offset(skip).limit(limit).all()

def parse_dice_notation_for_rp(notation: str) -> Optional[dict]:
    match = re.match(r"^(\d+)d(\d+)(?:([+-])(\d+))?$", notation.strip().lower())
    if not match:
        return None

    num_dice = int(match.group(1))
    num_sides = int(match.group(2))

    if num_dice <= 0 or num_sides <= 0 or num_dice > 100: return None
    rolls = [random.randint(1, num_sides) for _ in range(num_dice)]
    total = sum(rolls)
    return {"num_dice": num_dice, "num_sides": num_sides, "rolls": rolls, "total": total}
