from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from .. import crud, schemas, auth, models
from ..database import get_db

router = APIRouter(
    prefix="/api/games",
    tags=["games"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=schemas.GameDetails, status_code=status.HTTP_201_CREATED)
def create_new_game(
    game: schemas.GameCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Create a new game. The logged-in user will be the Game Master.
    """
    created_game = crud.create_game(db=db, game=game, master_id=current_user.id)
    # To return the game with master details, we might need to fetch it again or structure the return carefully
    # For simplicity now, let's assume the created_game object has the master relationship loaded
    # or we can re-fetch it.
    return crud.get_game_by_id(db, game_id=created_game.id) # This ensures relationships are eager/lazy loaded as per model

@router.get("/", response_model=List[schemas.GameDetails])
def read_games(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Retrieve a list of games.
    Supports pagination with skip and limit query parameters.
    Each game will include master and player details.
    """
    games = crud.get_games(db, skip=skip, limit=limit)
    return games

@router.get("/my-games", response_model=List[schemas.GameDetails])
def read_my_games(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Retrieve a list of games created by the current logged-in user (Game Master).
    Supports pagination.
    """
    return crud.get_games_by_master_id(db, master_id=current_user.id, skip=skip, limit=limit)

@router.get("/{game_id}", response_model=schemas.GameDetails)
def read_game(game_id: int, db: Session = Depends(get_db)):
    """
    Retrieve a specific game by its ID, including master and player details.
    """
    db_game = crud.get_game_by_id(db, game_id=game_id)
    if db_game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return db_game

@router.post("/{game_id}/join", response_model=schemas.GameDetails)
def join_game(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Allows the current logged-in user to join a game as a player.
    """
    game = crud.get_game_by_id(db, game_id=game_id)
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    if game.master_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game master cannot join their own game as a player")
    if current_user in game.players:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already a player in this game")

    updated_game = crud.add_player_to_game(db=db, game=game, user=current_user)
    # Re-fetch with joinedload to ensure the response model is correctly populated with all details
    return crud.get_game_by_id(db, game_id=updated_game.id)

@router.post("/{game_id}/leave", response_model=schemas.GameDetails)
def leave_game(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Allows the current logged-in user to leave a game they have joined.
    """
    game = crud.get_game_by_id(db, game_id=game_id) # Eager loads players
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    if current_user not in game.players:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not a player in this game")

    updated_game = crud.remove_player_from_game(db=db, game=game, user=current_user)
    # Re-fetch with joinedload to ensure the response model is correctly populated
    return crud.get_game_by_id(db, game_id=updated_game.id)

@router.post("/{game_id}/remove-player/{player_user_id}", response_model=schemas.GameDetails)
def gm_remove_player_from_game(
    game_id: int,
    player_user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Allows the Game Master of a game to remove a specific player from that game.
    """
    game = crud.get_game_by_id(db, game_id=game_id) # Eager loads players and master
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    # Check if the current user is the master of this game
    if game.master_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the game master can remove players")

    player_to_remove = crud.get_user_by_id(db, user_id=player_user_id) # We'll need to add get_user_by_id
    if not player_to_remove:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player to remove not found")

    if player_to_remove not in game.players:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Specified user is not a player in this game")

    updated_game = crud.remove_player_from_game(db=db, game=game, user=player_to_remove)
    return crud.get_game_by_id(db, game_id=updated_game.id)