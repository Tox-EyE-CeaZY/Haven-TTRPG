from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
# from fastapi.responses import JSONResponse # No longer directly used here, but good to keep for potential future use in routers
import os
from dotenv import load_dotenv
from pathlib import Path

from .database import engine, Base, get_db
from .routers import users, games, messages
# from . import models, auth, schemas # No longer needed for root route logic
# from sqlalchemy.orm import Session # No longer needed for root route logic

# Load environment variables from .env file
load_dotenv()

# Create database tables if they don't exist
Base.metadata.create_all(bind=engine)

# Ensure avatar directory exists
AVATAR_DIR_MAIN = Path("_data") / "avatars"
AVATAR_DIR_MAIN.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="TTRPG Platform API")

# CORS Middleware
# Define the list of allowed origins.
origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"), # Your Next.js frontend
    "http://localhost:3000",  # Explicitly for local Next.js development
    "https://localhost:3000", # For local Next.js dev with HTTPS (if you use it)
    "http://zone2.intrashare.org", # Your frontend's HTTP origin (if applicable)
    "https://zone2.intrashare.org", # Your frontend's HTTPS origin
    # Add other origins if necessary (e.g., your deployed frontend URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(users.router)
app.include_router(games.router)
app.include_router(messages.router)

@app.get("/")
async def read_root():
    return {"message": "Welcome to the TTRPG Platform API. See /docs for API documentation."}

# Page-serving routes like /register, /login, /logout are removed as Next.JS will handle them.