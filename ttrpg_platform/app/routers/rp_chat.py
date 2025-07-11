# e:\Random Stuff\App App\TTRPG Site\ttrpg_platform\app\routers\rp_chat.py
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional # Ensure Optional is imported
import json
from datetime import datetime # Ensure datetime is imported

from .. import crud, schemas, auth, models # schemas will now have RpChatMessageCreate etc.
from ..database import get_db

router = APIRouter(
    prefix="/api/rp-chat",
    tags=["rp-chat"],
    responses={404: {"description": "Not found"}},
)

class RpConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel_id: str):
        await websocket.accept()
        if channel_id not in self.active_connections:
            self.active_connections[channel_id] = []
        self.active_connections[channel_id].append(websocket)
        print(f"WS connected to RP channel {channel_id}. Total in channel: {len(self.active_connections[channel_id])}")

    def disconnect(self, websocket: WebSocket, channel_id: str):
        if channel_id in self.active_connections and websocket in self.active_connections[channel_id]:
            self.active_connections[channel_id].remove(websocket)
            if not self.active_connections[channel_id]: # If list is empty, remove channel key
                del self.active_connections[channel_id]
            print(f"WS disconnected from RP channel {channel_id}.")
        elif channel_id in self.active_connections:
             print(f"WS to disconnect not found in active connections for channel {channel_id}.")
        else:
            print(f"Channel {channel_id} not found in active connections for disconnect.")

    async def broadcast_to_channel(self, channel_id: str, message_data: schemas.RpChatMessageResponse): # Expect RpChatMessageResponse
        if channel_id in self.active_connections:
            connections_to_broadcast = list(self.active_connections[channel_id])
            # Pydantic's model_dump_json() is preferred for proper serialization including aliases
            json_message_to_send = message_data.model_dump_json(by_alias=True)
            for connection in connections_to_broadcast:
                try:
                    await connection.send_text(json_message_to_send) # Send JSON string
                except Exception as e:
                    print(f"Error broadcasting to a WS in channel {channel_id}: {e}")
                    self.disconnect(connection, channel_id)

rp_chat_manager = RpConnectionManager()

TEST_CHANNEL_ID_FOR_GDM_RP = "gdm-rp-test-channel"
PLACEHOLDER_GAME_ID_FOR_DB = 0 # Ensure game ID 0 exists in your DB.

@router.post("/{channel_id}/messages", response_model=schemas.RpChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_rp_message(
    channel_id: str,
    message_in: schemas.RpChatMessageCreate,
    db: Session = Depends(get_db),
    # current_user: models.User = Depends(auth.get_current_active_user) # Optional auth
):
    if channel_id != TEST_CHANNEL_ID_FOR_GDM_RP:
        raise HTTPException(status_code=403, detail="Channel not permitted")

    actual_sender_id: Optional[int] = None
    # Add logic to map message_in.senderName to a user_id if senderType is 'character'
    
    # message_in (schemas.RpChatMessageCreate) already has all necessary fields,
    # including character_id and owner_user_id, and aliases for DB fields.
    # crud.create_game_message_rp_style will use these.
    db_message = crud.create_game_message_rp_style(
        db=db,
        game_id=PLACEHOLDER_GAME_ID_FOR_DB,
        sender_id=actual_sender_id,
        message_data=message_in # Pass RpChatMessageCreate directly
    )
    if not db_message:
        raise HTTPException(status_code=500, detail="Failed to create message in database")

    # Convert the SQLAlchemy model instance to the Pydantic response model for broadcasting and returning
    # This handles aliasing (e.g. sender_display_name to senderName) and type conversions (id to str, timestamp to str)
    # and ensures character_id and owner_user_id are included.
    message_for_broadcast_and_response = schemas.RpChatMessageResponse.from_orm(db_message)

    await rp_chat_manager.broadcast_to_channel(channel_id, message_for_broadcast_and_response)
    
    return message_for_broadcast_and_response

@router.get("/{channel_id}/messages", response_model=List[schemas.RpChatMessageResponse])
async def get_rp_messages(
    channel_id: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    if channel_id != TEST_CHANNEL_ID_FOR_GDM_RP:
        raise HTTPException(status_code=403, detail="Channel not permitted")
        
    db_messages = crud.get_game_messages_rp_style(db, game_id=PLACEHOLDER_GAME_ID_FOR_DB, skip=skip, limit=limit)
    # Convert each SQLAlchemy model instance to the Pydantic response model
    return [schemas.RpChatMessageResponse.from_orm(msg) for msg in db_messages]

class RpDiceRollRequest(schemas.BaseModel):
    notation: str
    rollerName: str

# Changed response_model to RpChatMessageResponse for consistency
@router.post("/{channel_id}/roll", response_model=schemas.RpChatMessageResponse)
async def rp_dice_roll(
    channel_id: str,
    roll_request: RpDiceRollRequest,
    db: Session = Depends(get_db),
):
    if channel_id != TEST_CHANNEL_ID_FOR_GDM_RP:
        raise HTTPException(status_code=403, detail="Channel not permitted")

    parsed_roll = crud.parse_dice_notation_for_rp(roll_request.notation)
    if not parsed_roll:
        raise HTTPException(status_code=400, detail="Invalid dice notation")

    roll_content = f"{roll_request.rollerName} rolls!! (d{parsed_roll['num_sides']} x {parsed_roll['num_dice']} = [{', '.join(map(str, parsed_roll['rolls']))}] --> {parsed_roll['total']})"
    
    # Use RpChatMessageCreate for consistency, as it's what create_game_message_rp_style expects
    # and it includes character_id and owner_user_id (which will be None for system messages)
    system_message_data = schemas.RpChatMessageCreate(
        content=roll_content,
        senderName="System", # Aliased to sender_display_name
        senderType="system",  # Aliased to sender_role
        avatar=None,          # Aliased to sender_avatar_url
        character_id=None,    # Explicitly None
        owner_user_id=None    # Explicitly None
    )
    db_system_message = crud.create_game_message_rp_style(db, game_id=PLACEHOLDER_GAME_ID_FOR_DB, sender_id=None, message_data=system_message_data)
    
    if not db_system_message:
        raise HTTPException(status_code=500, detail="Failed to save dice roll message to DB")

    # Convert the SQLAlchemy model instance to the Pydantic response model for broadcasting and returning
    message_for_broadcast_and_response = schemas.RpChatMessageResponse.from_orm(db_system_message)
    await rp_chat_manager.broadcast_to_channel(channel_id, message_for_broadcast_and_response)
    return message_for_broadcast_and_response

@router.websocket("/ws/{channel_id}")
async def websocket_rp_chat_endpoint(websocket: WebSocket, channel_id: str):
    await rp_chat_manager.connect(websocket, channel_id)
    try:
        while True:
            await websocket.receive_text() # Keep connection alive
    except WebSocketDisconnect:
        rp_chat_manager.disconnect(websocket, channel_id)
    except Exception as e:
        print(f"Error in RP Chat WebSocket for channel {channel_id}: {e}")
        rp_chat_manager.disconnect(websocket, channel_id)
