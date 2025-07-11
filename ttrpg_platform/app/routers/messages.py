from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict

from .. import crud, schemas, auth, models
from ..database import get_db
from ..utils.email_utils import send_email_notification # Import from the new location
import os # <--- Corrected import
from datetime import datetime, timedelta, timezone # Import the datetime module and timedelta, timezone
import json # For sending JSON over WebSocket

# Define a cool-down period for DM email notifications (e.g., 15 minutes)
DM_EMAIL_COOLDOWN_MINUTES = 15

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {} # user_id: WebSocket

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        print(f"User {user_id} connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            print(f"User {user_id} disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message_json(self, data: dict, user_id: int):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            await websocket.send_json(data)

router = APIRouter(
    prefix="/api", # General prefix, specific routes will refine
    tags=["messages"],
    responses={404: {"description": "Not found"}},
)

manager = ConnectionManager()

# --- In-Game Chat Messages ---

@router.post("/games/{game_id}/messages", response_model=schemas.GameMessage, status_code=status.HTTP_201_CREATED)
def send_message_to_game(
    game_id: int,
    message: schemas.GameMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Send a message to a specific game chat.
    The user must be a participant (player or GM) of the game.
    """
    game = crud.get_game_by_id(db, game_id=game_id)
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    # Check if the current user is the GM or one of the players
    is_gm = game.master_id == current_user.id
    is_player = current_user in game.players

    if not (is_gm or is_player):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to send messages to this game")

    return crud.create_game_message(db=db, message_create=message, game_id=game_id, sender_id=current_user.id)


@router.get("/games/{game_id}/messages", response_model=List[schemas.GameMessage])
def get_messages_for_game(
    game_id: int,
    skip: int = 0,
    limit: int = 50, # Default to 50 messages, can be adjusted
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Retrieve messages for a specific game.
    The user must be a participant (player or GM) of the game.
    Messages are returned in ascending order of timestamp (oldest first).
    """
    game = crud.get_game_by_id(db, game_id=game_id)
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    is_gm = game.master_id == current_user.id
    is_player = current_user in game.players

    if not (is_gm or is_player):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view messages for this game")

    return crud.get_game_messages(db=db, game_id=game_id, skip=skip, limit=limit)


# --- Direct Messages (DM) ---

@router.post("/users/{receiver_user_id}/messages", response_model=schemas.DirectMessage, status_code=status.HTTP_201_CREATED) # Made async
async def send_direct_message(
    receiver_user_id: int,
    message: schemas.DirectMessageCreate,
    background_tasks: BackgroundTasks, # Add BackgroundTasks dependency
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Send a direct message to another user.
    """
    if current_user.id == receiver_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot send a message to yourself")

    receiver_user = crud.get_user_by_id(db, user_id=receiver_user_id)
    if not receiver_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receiver user not found")

    new_dm_db = crud.create_direct_message(db=db, message_create=message, sender_id=current_user.id, receiver_id=receiver_user_id)
    
    # Prepare message data for WebSocket broadcast
    message_to_send = schemas.DirectMessage.from_orm(new_dm_db).model_dump(mode='json') # Convert datetime to string

    # Create a notification for the receiver
    notification_content = f"New message from {current_user.nickname or current_user.username}: {message.content[:50]}{'...' if len(message.content) > 50 else ''}"
    crud.create_notification(db=db, notification=schemas.NotificationCreate(
        user_id=receiver_user_id,
        type="new_dm",
        content=notification_content,
        link=f"/dm?targetUser={current_user.username}" # Link to open the chat with the sender
    ))

    # Send email notification if user has it enabled and an email address
    if receiver_user.email_notifications_enabled and receiver_user.email:
        # Check if receiver is online via WebSocket
        is_receiver_online_ws = receiver_user.id in manager.active_connections

        if is_receiver_online_ws:
            print(f"DM Email to {receiver_user.email} (from {current_user.username}) skipped, user is online via WebSocket.")
            # Future: Could add to a "send later if unread" queue or include in a digest if not read.
        else:
            # User is not online, proceed with cool-down check and potential email
            cooldown_check = crud.get_dm_notification_cooldown(db, original_sender_id=current_user.id, receiver_id=receiver_user.id)
            
            can_send_email = True
            if cooldown_check and cooldown_check.last_email_sent_at:
                # Ensure last_email_sent_at is offset-aware for comparison
                last_sent_aware = cooldown_check.last_email_sent_at.replace(tzinfo=timezone.utc) if cooldown_check.last_email_sent_at.tzinfo is None else cooldown_check.last_email_sent_at
                if datetime.now(timezone.utc) < last_sent_aware + timedelta(minutes=DM_EMAIL_COOLDOWN_MINUTES):
                    can_send_email = False
                    print(f"DM Email to {receiver_user.email} (from {current_user.username}) skipped due to cool-down.")

            if can_send_email:
                email_subject = f"New Direct Message from {current_user.nickname or current_user.username} on Haven"
                email_body_data = {
                    "recipient_name": receiver_user.nickname or receiver_user.username,
                    "sender_name": current_user.nickname or current_user.username,
                    "message_preview": message.content[:100] + ('...' if len(message.content) > 100 else ''),
                    "dm_link": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dm?targetUser={current_user.username}",
                    "current_year": datetime.now(timezone.utc).year
                }
                # Schedule email sending as a background task
                background_tasks.add_task(
                    send_email_notification,
                    subject=email_subject,
                    recipient_email=receiver_user.email,
                    body_data=email_body_data,
                    template_name="new_dm_notification.html"
                )
                # Update the cooldown timestamp
                crud.upsert_dm_notification_cooldown(db, original_sender_id=current_user.id, receiver_id=receiver_user.id)

    # Send to receiver via WebSocket if connected
    await manager.send_personal_message_json(message_to_send, receiver_user_id)
    return new_dm_db

@router.get("/users/{other_user_id}/messages", response_model=List[schemas.DirectMessage])
def get_direct_message_history(
    other_user_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Retrieve the direct message history between the current user and another user.
    """
    other_user = crud.get_user_by_id(db, user_id=other_user_id)
    if not other_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Other user not found")

    if current_user.id == other_user_id:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot fetch DM history with yourself using this endpoint.")

    return crud.get_direct_messages_between_users(db=db, user1_id=current_user.id, user2_id=other_user_id, skip=skip, limit=limit)


@router.get("/me/conversations", response_model=List[schemas.Conversation])
def list_my_conversations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    List all direct message conversations for the current user, showing the other participant
    and the last message exchanged.
    """
    latest_messages_in_convos = crud.get_user_conversations(db=db, user_id=current_user.id)
    
    conversations_data = []
    for msg in latest_messages_in_convos:
        other_user_details = msg.sender if msg.receiver_id == current_user.id else msg.receiver
        conversations_data.append(schemas.Conversation(
            other_user=schemas.User.from_orm(other_user_details),
            last_message=schemas.DirectMessage.from_orm(msg)
            # unread_count can be calculated here if needed, e.g., by another query
        ))
    return conversations_data

@router.websocket("/ws/dm")
async def websocket_dm_endpoint(
    websocket: WebSocket,
    token: str = Query(...), # Require token as a query parameter
    db: Session = Depends(get_db) # get_db needs to be available for WS if used like this
):
    """
    WebSocket endpoint for Direct Messages.
    Authenticates user via token in query param.
    Keeps connection open to receive real-time messages.
    """
    current_user = await auth.get_current_user_from_token_for_ws(token=token, db=db)

    if not current_user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication failed")
        return

    await manager.connect(websocket, current_user.id)
    try:
        while True:
            # Keep connection alive, or handle client-sent messages if any
            # For DMs, usually server pushes, client listens.
            # Client might send pings or other control messages.
            await websocket.receive_text() # Or receive_json if client sends structured data
    except WebSocketDisconnect:
        manager.disconnect(current_user.id)
    except Exception as e:
        print(f"Error in WebSocket for user {current_user.id}: {e}")
        manager.disconnect(current_user.id)
        # Consider logging the error properly
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)