# e:\Random Stuff\App App\TTRPG Site\ttrpg_platform\app\utils\email_utils.py
import os
from pathlib import Path
from fastapi_mail import FastMail, MessageSchema, MessageType, ConnectionConfig
from pydantic import EmailStr

# This configuration will be initialized from main.py
fm_instance: FastMail = None

def initialize_mailer(conf: ConnectionConfig):
    global fm_instance
    fm_instance = FastMail(conf)

async def send_email_notification(subject: str, recipient_email: EmailStr, body_data: dict, template_name: str):
    if fm_instance is None:
        raise RuntimeError("Email service not initialized. Call initialize_mailer first.")
    message = MessageSchema(
        subject=subject,
        recipients=[recipient_email],
        template_body=body_data,
        subtype=MessageType.html
    )
    try:
        await fm_instance.send_message(message, template_name=template_name)
        print(f"Email successfully sent to {recipient_email} with subject: {subject}")
    except Exception as e:
        print(f"Error sending email to {recipient_email}: {e}")