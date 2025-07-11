from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict
from datetime import datetime, timedelta, timezone
import os

from .. import crud, models, schemas, auth
from ..database import get_db
from ..utils.email_utils import send_email_notification

router = APIRouter(
    prefix="/api/tasks",
    tags=["tasks"],
    # For a real admin endpoint, you'd add security:
    # dependencies=[Depends(auth.get_current_active_admin_user)] 
)

# --- Digest Configuration ---
DIGEST_PERIOD_HOURS = 24  # Default period for fetching notifications for a digest
# Notification types to be included in digests. Others might be immediate or ignored for email.
DIGEST_NOTIFICATION_TYPES = [
    "new_game_post", 
    "game_updated", 
    "player_joined_your_game", 
    "application_to_your_game",
    # Add other notification types that should be bundled into a digest
    # "new_forum_reply", "event_reminder", etc.
]
# Notification types that should NOT be in a digest (e.g., DMs are handled separately)
EXCLUDED_FROM_DIGEST_TYPES = ["new_dm"]


def _prepare_notification_data_for_email(db: Session, notification: models.Notification) -> Dict:
    """
    Enhances notification data with more context for email templates.
    This is a placeholder and needs to be fleshed out based on your Notification model
    and how related entity information (like game names, user names) is stored or fetched.
    """
    data = schemas.Notification.from_orm(notification).model_dump()
    data["content_preview"] = notification.content[:70] + "..." if len(notification.content) > 70 else notification.content
    
    # Example: Add game name if it's a game-related notification
    # This requires `related_entity_id` to be meaningful and potentially a way to know entity_type
    if notification.type in ["new_game_post", "game_updated", "player_joined_your_game", "application_to_your_game"]:
        if notification.related_entity_id: # Assuming this is game_id for these types
            # In a real scenario, you'd fetch the game name:
            # game = crud.get_game_by_id(db, game_id=int(notification.related_entity_id))
            # if game: data["game_name_placeholder"] = game.name
            data["game_name_placeholder"] = f"Game ID {notification.related_entity_id}" # Placeholder
        else:
            data["game_name_placeholder"] = "A game"

    if notification.type == "player_joined_your_game":
        # Assuming content might be "UsernameX joined..."
        # This is very basic parsing, better to store structured data if possible
        parts = notification.content.split(" ")
        data["player_name_placeholder"] = parts[0] if parts else "Someone"
    
    if notification.type == "application_to_your_game":
        parts = notification.content.split(" ")
        data["applicant_name_placeholder"] = parts[0] if parts else "Someone"

    return data


def _group_notifications_for_digest(db: Session, notifications: List[models.Notification]) -> Dict[str, List[Dict]]:
    grouped: Dict[str, List[Dict]] = {notif_type: [] for notif_type in DIGEST_NOTIFICATION_TYPES}
    
    for notif in notifications:
        if notif.type in grouped:
            prepared_data = _prepare_notification_data_for_email(db, notif)
            grouped[notif.type].append(prepared_data)
    return grouped


async def _send_digests_for_user(user: models.User, db: Session):
    """Helper function to process and send digest for a single user."""
    # Determine the 'since' time for fetching notifications
    since_time = user.last_digest_sent_at
    if not since_time: # First digest or if we don't track last_digest_sent_at
            since_time = datetime.now(timezone.utc) - timedelta(hours=DIGEST_PERIOD_HOURS)
    
    notifications_to_send = crud.get_notifications_for_digest(
        db=db, 
        user_id=user.id, 
        since=since_time,
        excluded_types=EXCLUDED_FROM_DIGEST_TYPES,
        included_types=DIGEST_NOTIFICATION_TYPES # Only fetch types meant for digest
    )

    if not notifications_to_send:
        print(f"No new digest notifications for user {user.username} since {since_time.strftime('%Y-%m-%d %H:%M UTC') if since_time else 'the beginning'}.")
        return

    print(f"Found {len(notifications_to_send)} notifications for user {user.username} for digest.")
    grouped_notifications = _group_notifications_for_digest(db, notifications_to_send)
    
    has_content_for_digest = any(len(notifs) > 0 for notifs in grouped_notifications.values())
    if not has_content_for_digest:
        print(f"No content for digest for user {user.username} after grouping.")
        # Optionally, still update last_digest_sent_at if you want to mark this period as "checked"
        # crud.update_user_last_digest_sent_time(db, user_id=user.id)
        return

    email_subject = "Your Haven Activity Digest"
    email_body_data = {
        "recipient_name": user.nickname or user.username,
        "digest_period_name": f"since {since_time.strftime('%b %d, %Y at %I:%M %p UTC') if since_time else 'your last visit'}",
        "settings_link": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/settings",
        "current_year": datetime.now(timezone.utc).year,
        **grouped_notifications
    }
    
    try:
        await send_email_notification(
            subject=email_subject,
            recipient_email=user.email, # Ensured by query
            body_data=email_body_data,
            template_name="digest_notification.html"
        )
        print(f"Digest email task added for {user.email}")

        # Mark notifications as emailed in digest
        notification_ids_sent = [n.id for n in notifications_to_send]
        marked_count = crud.mark_notifications_as_emailed_in_digest(db, notification_ids_sent)
        
        crud.update_user_last_digest_sent_time(db, user_id=user.id)
        db.commit() # Commit changes for this user (marking notifications and updating last_digest_sent_at)
        print(f"Updated last_digest_sent_at for {user.username} and marked {marked_count} notifications as emailed_in_digest.")

    except Exception as e:
        db.rollback() # Rollback if sending or marking fails for this user
        print(f"Failed to send digest or update status for {user.email}: {e}")
        # Log this error properly in a production system


async def _scheduled_digest_sender_task(db: Session):
    """The actual task that gets scheduled."""
    print(f"Digest Task Started at {datetime.now(timezone.utc)}")
    users_for_digest = db.query(models.User).filter(
        models.User.email_notifications_enabled == True,
        models.User.email != None # Ensure email exists
    ).all()

    for user in users_for_digest:
        # Check if it's time to send a digest for this user based on DIGEST_PERIOD_HOURS
        # and user.last_digest_sent_at
        if user.last_digest_sent_at and \
           (datetime.now(timezone.utc) < user.last_digest_sent_at + timedelta(hours=DIGEST_PERIOD_HOURS -1)): # -1 to give a little buffer
            print(f"Skipping digest for {user.username}, not yet time.")
            continue
        
        await _send_digests_for_user(user, db)
    
    print(f"Digest Task Finished at {datetime.now(timezone.utc)}")


@router.post("/send-digests", status_code=status.HTTP_202_ACCEPTED)
async def trigger_send_notification_digests_endpoint(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    # current_admin: models.User = Depends(auth.get_current_active_admin_user) # Secure this
):
    """
    Manually triggers the process to send notification digests to all eligible users.
    In production, _scheduled_digest_sender_task would be run by a scheduler.
    """
    # For manual trigger, we'll iterate all users and send if they have pending notifications
    # without strictly adhering to the DIGEST_PERIOD_HOURS from last_sent time,
    # or we can respect it. Let's respect it for consistency.
    
    # This background task will now call the refined _scheduled_digest_sender_task
    # which itself iterates through users.
    background_tasks.add_task(_scheduled_digest_sender_task, db=db)
    return {"message": "Notification digest sending process for all users initiated in the background."}
