import logging
import random
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from config import Config
from symptom_engine import analyze_symptoms

logger = logging.getLogger("healthcare_assistant.services")


class EmailService:
    """Handles sending email alerts and notifications."""

    @staticmethod
    def send_verification_otp(recipient_email: str, otp_code: str) -> bool:
        """
        Sends the 4-digit OTP to recipient's inbox using configured SMTP server.
        """
        if not Config.is_smtp_configured():
            logger.warning("SMTP credentials not configured — OTP email NOT sent.")
            return False

        try:
            msg = MIMEMultipart("alternative")
            msg["From"]    = Config.SMTP_SENDER
            msg["To"]      = recipient_email
            msg["Subject"] = f"Your MediGuard AI Verification Code: {otp_code}"

            html_body = f"""
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;
                        padding:32px;background:#f8fafc;border-radius:12px;">
              <div style="text-align:center;margin-bottom:24px;">
                <h1 style="color:#e11d48;margin:0;font-size:28px;">MediGuard AI</h1>
                <p style="color:#64748b;margin:4px 0 0;">Email Verification</p>
              </div>
              <div style="background:white;border-radius:8px;padding:28px;
                          text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                <p style="color:#334155;font-size:16px;margin:0 0 20px;">
                  Your one-time verification code is:
                </p>
                <div style="background:#f1f5f9;border:2px dashed #e11d48;border-radius:8px;
                            padding:20px;margin:0 auto 20px;display:inline-block;min-width:160px;">
                  <span style="font-size:40px;font-weight:bold;
                               letter-spacing:12px;color:#e11d48;">{otp_code}</span>
                </div>
                <p style="color:#64748b;font-size:14px;margin:0;">
                  This code expires in <strong>5 minutes</strong>.
                </p>
              </div>
              <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:20px;">
                If you did not request this, please ignore this email.
              </p>
            </div>
            """
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
                server.sendmail(Config.SMTP_SENDER, recipient_email, msg.as_string())

            logger.info(f"OTP email sent successfully via SMTP to {recipient_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send OTP email via SMTP to {recipient_email}: {e}")
            return False


class OTPService:
    """Manages generation, storage, and validation of Verification OTPs."""
    
    # Memory store: maps email -> {"otp": code, "expires_at": datetime}
    _store: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def generate_otp(cls, email: str) -> str:
        """Generates a new 4-digit verification code with a 5-minute expiry."""
        otp_code = str(random.randint(1000, 9999))
        expiry = datetime.utcnow() + timedelta(minutes=5)
        cls._store[email.strip().lower()] = {
            "otp": otp_code,
            "expires_at": expiry
        }
        return otp_code

    @classmethod
    def verify_otp(cls, email: str, otp_code: str) -> Tuple[bool, str]:
        """
        Validates OTP code. Returns (success, message).
        """
        email_key = email.strip().lower()
        if email_key not in cls._store:
            return False, "No pending verification request found for this email."
            
        data = cls._store[email_key]
        if datetime.utcnow() > data["expires_at"]:
            del cls._store[email_key]
            return False, "The verification OTP code has expired. Please sign up again."
            
        if data["otp"] != otp_code.strip():
            return False, "Invalid OTP code. Please check and try again."
            
        # Clear code on success
        del cls._store[email_key]
        return True, "Email verified successfully."


class SymptomAnalysisService:
    """Manages Symptom diagnosis processing."""

    @staticmethod
    def analyze(symptoms_text: str, age: int, gender: str) -> Dict[str, Any]:
        """Performs diagnosis matching and returns result payload."""
        result = analyze_symptoms(symptoms_text, age, gender)
        result["entered_symptoms"] = symptoms_text
        return result
