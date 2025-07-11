from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from .. import crud, schemas, auth, models
from ..database import get_db

router = APIRouter(
    prefix="/api/notifications",
    tags=["notifications"],
    responses={404: {"description": "Not found"}},
)

@router.get("/me", response_model=List[schemas.Notification])
def read_my_notifications(
    skip: int = 0,
    limit: int = 20,
    include_read: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Retrieve notifications for the current user.
    By default, only unread notifications are returned.
    """
    notifications = crud.get_notifications_for_user(
        db, user_id=current_user.id, skip=skip, limit=limit, include_read=include_read
    )
    return notifications

@router.post("/{notification_id}/read", response_model=schemas.Notification)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Mark a specific notification as read.
    """
    db_notification = crud.mark_notification_as_read(db, notification_id=notification_id, user_id=current_user.id)
    if db_notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found or not owned by user")
    return db_notification

@router.post("/mark-all-read", response_model=dict)
def mark_all_my_notifications_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """
    Mark all unread notifications for the current user as read.
    Returns the count of notifications that were marked as read.
    """
    updated_count = crud.mark_all_notifications_as_read_for_user(db, user_id=current_user.id)
    if updated_count == 0:
        # Not an error, but good to indicate no action was taken if nothing was unread
        return {"message": "No unread notifications to mark as read.", "updated_count": 0}
    return {"message": f"Successfully marked {updated_count} notifications as read.", "updated_count": updated_count}

