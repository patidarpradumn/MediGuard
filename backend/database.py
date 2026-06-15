import os
import logging
from datetime import datetime
from typing import Optional
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# Configure logger
logger = logging.getLogger("healthcare_assistant.database")

# Read MongoDB URI from environment variables
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/healthcare_db")

db_name = "healthcare_db"
if "/" in MONGO_URI.replace("://", ""):
    parts = MONGO_URI.split("/")
    if parts[-1]:
        db_name = parts[-1].split("?")[0]

logger.info(f"Initializing MongoDB client with URI: {MONGO_URI} and database: {db_name}")

client = None
db = None

def get_db():
    """
    Initializes and returns the MongoDB database instance.
    Uses connection pooling provided by MongoClient.
    """
    global client, db
    if db is None:
        try:
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
            db = client[db_name]
            client.admin.command('ping')
            logger.info("Successfully connected to MongoDB.")
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            db = None
    return db

def check_db_health():
    """
    Checks if the database is reachable and returns health status.
    """
    database = get_db()
    if database is None:
        return False, "Database connection not initialized"
    try:
        database.client.admin.command('ping')
        return True, "Connected"
    except Exception as e:
        logger.error(f"MongoDB health check failed: {e}")
        return False, str(e)

# --- USER AUTHENTICATION DATABASE LOGIC ---

def get_user_by_email(email: str):
    """
    Retrieves user record by unique email address.
    """
    database = get_db()
    if database is None:
        logger.warning("Database offline. Cannot fetch user.")
        return None
    try:
        return database.users.find_one({"email": email})
    except Exception as e:
        logger.error(f"Failed to query user by email: {e}")
        return None

def create_user(email: str, password_hash: str):
    """
    Creates a new user record. Initially is_verified is set to False (pending OTP).
    """
    database = get_db()
    if database is None:
        logger.warning("Database offline. Cannot create user.")
        return None
    try:
        # Check if already exists
        if get_user_by_email(email):
            logger.warning(f"User with email {email} already exists.")
            return None
            
        user_doc = {
            "email": email,
            "password_hash": password_hash,
            "is_verified": False,
            "created_at": datetime.utcnow().isoformat()
        }
        database.users.insert_one(user_doc)
        logger.info(f"Created pending user record for email: {email}")
        return user_doc
    except Exception as e:
        logger.error(f"Failed to create user: {e}")
        return None

def verify_user(email: str):
    """
    Marks a user as verified after successful OTP entry.
    """
    database = get_db()
    if database is None:
        return False
    try:
        result = database.users.update_one(
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

# --- PERSONALIZED HISTORY LOGIC ---

def save_prediction(symptoms: str, age: int, gender: str, email: str, analysis_result: dict):
    """
    Saves a prediction result to MongoDB predictions collection linked to a user email.
    """
    database = get_db()
    if database is None:
        logger.warning("Database connection unavailable. Prediction history not saved.")
        return None

    try:
        record = {
            "email": email, # Link history to this user
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
        result = database.predictions.insert_one(record)
        logger.info(f"Saved prediction history with ID: {result.inserted_id} for user {email}")
        return str(result.inserted_id)
    except Exception as e:
        logger.error(f"Failed to save prediction to MongoDB: {e}")
        return None

def get_predictions(email: str, limit: int = 10):
    """
    Retrieves the most recent predictions from MongoDB history collection for a specific user email.
    """
    database = get_db()
    if database is None:
        logger.warning("Database connection unavailable. Cannot fetch history.")
        return []

    try:
        cursor = database.predictions.find({"email": email}).sort("timestamp", -1).limit(limit)
        predictions = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            predictions.append(doc)
        return predictions
    except Exception as e:
        logger.error(f"Failed to retrieve predictions for user {email}: {e}")
        return []

def save_chat_message(email: str, role: str, content: str, file_name: Optional[str] = None):
    """
    Saves a chatbot conversation message (either from 'user' or 'assistant') to MongoDB.
    """
    database = get_db()
    if database is None:
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
        result = database.chat_logs.insert_one(record)
        return str(result.inserted_id)
    except Exception as e:
        logger.error(f"Failed to save chat message to MongoDB: {e}")
        return None

def get_chat_history(email: str, limit: int = 50):
    """
    Retrieves the chronological chat history for a specific user email.
    """
    database = get_db()
    if database is None:
        logger.warning("Database connection unavailable. Cannot fetch chat history.")
        return []

    try:
        cursor = database.chat_logs.find({"email": email}).sort("timestamp", 1).limit(limit)
        messages = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            messages.append(doc)
        return messages
    except Exception as e:
        logger.error(f"Failed to retrieve chat history for user {email}: {e}")
        return []

def set_user_conversation_id(email: str, conversation_id: str):
    """
    Saves the Antigravity conversation ID for a user email.
    """
    database = get_db()
    if database is None:
        return False
    try:
        database.users.update_one(
            {"email": email},
            {"$set": {"chat_conversation_id": conversation_id}}
        )
        return True
    except Exception as e:
        logger.error(f"Failed to set conversation ID for {email}: {e}")
        return False


