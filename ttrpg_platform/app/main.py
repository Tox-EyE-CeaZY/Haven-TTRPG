from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# from fastapi.responses import JSONResponse # No longer directly used here, but good to keep for potential future use in routers
import os
from dotenv import load_dotenv
from pathlib import Path
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from pydantic import EmailStr # For type hinting email addresses

from .database import engine, Base
# Import routers
from .routers import users, games, messages, notifications, tasks, rp_chat, characters, files
from .routers.characters import public_router as characters_public_router # Import public_router specifically from characters router
from .utils.email_utils import initialize_mailer # Import the initializer
# from . import models, auth, schemas # No longer needed for root route logic
# from sqlalchemy.orm import Session # No longer needed for root route logic

# Load environment variables from .env file
load_dotenv()

# Create database tables if they don't exist
Base.metadata.create_all(bind=engine)

# Ensure avatar directory exists
AVATAR_DIR_MAIN = Path("_data") / "avatars"
AVATAR_DIR_MAIN.mkdir(parents=True, exist_ok=True)

# Email Template Directory
EMAIL_TEMPLATE_DIR = Path(__file__).parent / 'templates' / 'email'
EMAIL_TEMPLATE_DIR.mkdir(parents=True, exist_ok=True) # Ensure it exists

print("Attempting to configure email (ConnectionConfig only)...") # Debug print
conf = ConnectionConfig(
    MAIL_USERNAME = os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD"),
    MAIL_FROM = os.getenv("MAIL_FROM", "default@example.com"), # Pass the string directly
    MAIL_PORT = int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER = os.getenv("MAIL_SERVER"),
    MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", "Haven"),
    MAIL_STARTTLS = os.getenv("MAIL_STARTTLS", "True").lower() == "true",
    MAIL_SSL_TLS = os.getenv("MAIL_SSL_TLS", "False").lower() == "true",
    USE_CREDENTIALS = True,
    VALIDATE_CERTS = True, # Set to False if using self-signed certs in dev, True for prod
    TEMPLATE_FOLDER = EMAIL_TEMPLATE_DIR
)

# Initialize the mailer instance in email_utils
initialize_mailer(conf) # Re-enable email initialization
print("Email initialization (FastMail) has been re-enabled.") # Debug print
app = FastAPI(
    title="Haven API",
)

app = FastAPI(
    title="Haven API",
)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# CORS Middleware
# Define the list of allowed origins.
origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"), # Your Next.js frontend
    "http://localhost:3000",  # Explicitly for local Next.js development
    "https://localhost:3000", # For local Next.js dev with HTTPS (if you use it)
    "http://zone2.intrashare.org", # Your frontend's HTTP origin (if applicable)
    "https://zone2.intrashare.org", # Your frontend's HTTPS origin
    "http://haven.intrashare.org", # Your production frontend URL
    "https://haven.intrashare.org", # Your production frontend URL with HTTPS
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
app.include_router(notifications.router) # Include notifications router
app.include_router(tasks.router) # Include tasks router
app.include_router(rp_chat.router) # Include RP Chat router
app.include_router(characters.router) # Include Roleplay Characters router
app.include_router(characters_public_router) # Include Public Roleplay Characters router
app.include_router(files.router) # Include file management router
@app.get("/")
async def read_root():
    return {"message": "Welcome to the Haven API. See /docs for API documentation."}

# Page-serving routes like /register, /login, /logout are removed as Next.JS will handle them.