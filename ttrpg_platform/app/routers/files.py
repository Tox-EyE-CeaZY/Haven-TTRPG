from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import FileResponse
from typing import List
from pathlib import Path
import os
from .. import models
from ..database import get_db
from sqlalchemy.orm import Session
from fastapi import BackgroundTasks
from fastapi.security import OAuth2PasswordBearer

router = APIRouter(prefix="/files", tags=["files"])

# --- CONFIG ---
BASE_DIR = Path("_data/usrstore/_files")
BASE_DIR.mkdir(parents=True, exist_ok=True)

# Dummy user dependency (replace with real auth)
def get_current_user():
    # Replace with actual user fetching logic
    class User:
        id = 1
        is_admin = False
    return User()

def get_user_dir(user):
    if user.is_admin:
        return BASE_DIR / "admin"
    return BASE_DIR / str(user.id)

# --- ENDPOINTS ---
@router.post("/upload", status_code=201)
def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    user_dir = get_user_dir(user)
    user_dir.mkdir(parents=True, exist_ok=True)
    file_path = user_dir / file.filename
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    return {"filename": file.filename}

@router.get("/list", response_model=List[str])
def list_files(user=Depends(get_current_user)):
    user_dir = get_user_dir(user)
    if not user_dir.exists():
        return []
    return [f.name for f in user_dir.iterdir() if f.is_file()]

@router.get("/download/{filename}")
def download_file(filename: str, user=Depends(get_current_user)):
    user_dir = get_user_dir(user)
    file_path = user_dir / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(file_path), filename=filename)

@router.delete("/delete/{filename}")
def delete_file(filename: str, user=Depends(get_current_user)):
    user_dir = get_user_dir(user)
    file_path = user_dir / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    os.remove(file_path)
    return {"detail": "File deleted"}
