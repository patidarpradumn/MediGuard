import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

class Config:
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    
    # MongoDB Config
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017/healthcare_db")
    
    # Auth Salt
    AUTH_SALT: str = os.getenv("AUTH_SALT", "medi_guard_super_salt_123")
    
    # Gemini SDK Config
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # SMTP Email configuration
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp-relay.brevo.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_SENDER: str = os.getenv("SMTP_SENDER", "")

    @classmethod
    def is_smtp_configured(cls) -> bool:
        """Returns True if all required SMTP configurations are present."""
        return bool(cls.SMTP_USER and cls.SMTP_PASSWORD)
