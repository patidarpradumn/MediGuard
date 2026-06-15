import logging
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from config import Config

logger = logging.getLogger("healthcare_assistant.repository")

class DatabaseConnection:
    """Manages the MongoDB client connection and database instances."""
    _client: Optional[MongoClient] = None
    _db = None

    @classmethod
    def get_db(cls):
        if cls._db is None:
            db_name = "healthcare_db"
            mongo_uri = Config.MONGO_URI
            if "/" in mongo_uri.replace("://", ""):
                parts = mongo_uri.split("/")
                if parts[-1]:
                    db_name = parts[-1].split("?")[0]
            
            logger.info(f"Initializing MongoDB client with URI: {mongo_uri} and database: {db_name}")
            try:
                cls._client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
                cls._db = cls._client[db_name]
                cls._client.admin.command('ping')
                logger.info("Successfully connected to MongoDB.")
            except (ConnectionFailure, ServerSelectionTimeoutError) as e:
                logger.error(f"Failed to connect to MongoDB: {e}")
                cls._db = None
        return cls._db

    @classmethod
    def check_health(cls) -> Tuple[bool, str]:
        database = cls.get_db()
        if database is None:
            return False, "Database connection not initialized"
        try:
            database.client.admin.command('ping')
            return True, "Connected"
        except Exception as e:
            logger.error(f"MongoDB health check failed: {e}")
            return False, str(e)


class UserRepository:
    """Handles data operations for User records."""

    @staticmethod
    def get_by_email(email: str) -> Optional[Dict[str, Any]]:
        db = DatabaseConnection.get_db()
        if db is None:
            logger.warning("Database offline. Cannot fetch user.")
            return None
        try:
            return db.users.find_one({"email": email})
        except Exception as e:
            logger.error(f"Failed to query user by email {email}: {e}")
            return None

    @staticmethod
    def create(email: str, password_hash: str) -> Optional[Dict[str, Any]]:
        db = DatabaseConnection.get_db()
        if db is None:
            logger.warning("Database offline. Cannot create user.")
            return None
        try:
            if UserRepository.get_by_email(email):
                logger.warning(f"User with email {email} already exists.")
                return None
                
            user_doc = {
                "email": email,
                "password_hash": password_hash,
                "is_verified": False,
                "created_at": datetime.utcnow().isoformat()
            }
            db.users.insert_one(user_doc)
            logger.info(f"Created pending user record for email: {email}")
            return user_doc
        except Exception as e:
            logger.error(f"Failed to create user: {e}")
            return None

    @staticmethod
    def verify(email: str) -> bool:
        db = DatabaseConnection.get_db()
        if db is None:
            return False
        try:
            result = db.users.update_one(
                {"email": email},
                {"$set": {"is_verified": True}}
            )
            if result.modified_count > 0:
                logger.info(f"User email {email} successfully marked verified.")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to verify user email {email}: {e}")
            return False

    @staticmethod
    def set_conversation_id(email: str, conversation_id: str) -> bool:
        db = DatabaseConnection.get_db()
        if db is None:
            return False
        try:
            db.users.update_one(
                {"email": email},
                {"$set": {"chat_conversation_id": conversation_id}}
            )
            return True
        except Exception as e:
            logger.error(f"Failed to set conversation ID for {email}: {e}")
            return False


class PredictionRepository:
    """Handles data operations for Symptom Prediction / Diagnostic History logs."""

    @staticmethod
    def save(symptoms: str, age: int, gender: str, email: str, analysis_result: Dict[str, Any]) -> Optional[str]:
        db = DatabaseConnection.get_db()
        if db is None:
            logger.warning("Database connection unavailable. Prediction history not saved.")
            return None
        try:
            record = {
                "email": email,
                "symptoms": symptoms,
                "age": age,
                "gender": gender,
                "doctor": analysis_result.get("doctor"),
                "risk": analysis_result.get("risk"),
                "advice": analysis_result.get("advice"),
                "matched_symptom": analysis_result.get("matched_symptom"),
                "home_remedies": analysis_result.get("home_remedies"),
                "timestamp": datetime.utcnow().isoformat()
            }
            result = db.predictions.insert_one(record)
            logger.info(f"Saved prediction history with ID: {result.inserted_id} for user {email}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to save prediction to MongoDB: {e}")
            return None

    @staticmethod
    def get_by_user(email: str, limit: int = 10) -> List[Dict[str, Any]]:
        db = DatabaseConnection.get_db()
        if db is None:
            logger.warning("Database connection unavailable. Cannot fetch history.")
            return []
        try:
            cursor = db.predictions.find({"email": email}).sort("timestamp", -1).limit(limit)
            predictions = []
            for doc in cursor:
                doc["_id"] = str(doc["_id"])
                predictions.append(doc)
            return predictions
        except Exception as e:
            logger.error(f"Failed to retrieve predictions for user {email}: {e}")
            return []


class ChatRepository:
    """Handles message saving and loading for the Wellness Assistant Chatbot."""

    @staticmethod
    def save_message(email: str, role: str, content: str, file_name: Optional[str] = None) -> Optional[str]:
        db = DatabaseConnection.get_db()
        if db is None:
            logger.warning("Database connection unavailable. Chat message not saved.")
            return None
        try:
            record = {
                "email": email,
                "role": role,
                "content": content,
                "timestamp": datetime.utcnow().isoformat()
            }
            if file_name:
                record["file_name"] = file_name
            result = db.chat_logs.insert_one(record)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to save chat message to MongoDB: {e}")
            return None

    @staticmethod
    def get_history_by_user(email: str, limit: int = 50) -> List[Dict[str, Any]]:
        db = DatabaseConnection.get_db()
        if db is None:
            logger.warning("Database connection unavailable. Cannot fetch chat history.")
            return []
        try:
            cursor = db.chat_logs.find({"email": email}).sort("timestamp", 1).limit(limit)
            messages = []
            for doc in cursor:
                doc["_id"] = str(doc["_id"])
                messages.append(doc)
            return messages
        except Exception as e:
            logger.error(f"Failed to retrieve chat history for user {email}: {e}")
            return []
