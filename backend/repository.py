import logging
import uuid
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
    """Handles data operations for User records with in-memory fallback."""
    _mock_users: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def get_by_email(email: str) -> Optional[Dict[str, Any]]:
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        if db is None:
            logger.warning("Database offline. Using mock in-memory store for lookup.")
            return UserRepository._mock_users.get(email_key)
        try:
            user = db.users.find_one({"email": email_key})
            if user:
                return user
            return UserRepository._mock_users.get(email_key)
        except Exception as e:
            logger.error(f"Failed to query user by email {email}: {e}")
            return UserRepository._mock_users.get(email_key)

    @staticmethod
    def create(email: str, password_hash: str) -> Optional[Dict[str, Any]]:
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        
        if UserRepository.get_by_email(email):
            logger.warning(f"User with email {email} already exists.")
            return None
            
        user_doc = {
            "email": email_key,
            "password_hash": password_hash,
            "is_verified": False,
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Always register in mock memory as fallback
        UserRepository._mock_users[email_key] = user_doc
        
        if db is None:
            logger.warning("Database offline. Saved user to mock in-memory store.")
            return user_doc
        try:
            db.users.insert_one(user_doc)
            logger.info(f"Created pending user record in MongoDB for email: {email}")
            return user_doc
        except Exception as e:
            logger.error(f"Failed to create user in MongoDB: {e}. Saved in memory.")
            return user_doc

    @staticmethod
    def verify(email: str) -> bool:
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        
        # Always update in mock memory
        if email_key in UserRepository._mock_users:
            UserRepository._mock_users[email_key]["is_verified"] = True
            
        if db is None:
            logger.warning("Database offline. Verified user in mock in-memory store.")
            return email_key in UserRepository._mock_users
        try:
            result = db.users.update_one(
                {"email": email_key},
                {"$set": {"is_verified": True}}
            )
            if result.modified_count > 0:
                logger.info(f"User email {email} successfully marked verified in MongoDB.")
                return True
            return email_key in UserRepository._mock_users
        except Exception as e:
            logger.error(f"Failed to verify user email {email}: {e}")
            return email_key in UserRepository._mock_users

    @staticmethod
    def set_conversation_id(email: str, conversation_id: str) -> bool:
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        
        if email_key in UserRepository._mock_users:
            UserRepository._mock_users[email_key]["chat_conversation_id"] = conversation_id
            
        if db is None:
            return email_key in UserRepository._mock_users
        try:
            db.users.update_one(
                {"email": email_key},
                {"$set": {"chat_conversation_id": conversation_id}}
            )
            return True
        except Exception as e:
            logger.error(f"Failed to set conversation ID for {email}: {e}")
            return email_key in UserRepository._mock_users


class PredictionRepository:
    """Handles data operations for Symptom Prediction / Diagnostic History logs with in-memory fallback."""
    _mock_predictions: List[Dict[str, Any]] = []

    @staticmethod
    def save(symptoms: str, age: int, gender: str, email: str, analysis_result: Dict[str, Any]) -> Optional[str]:
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        record_id = str(uuid.uuid4())
        record = {
            "_id": record_id,
            "email": email_key,
            "profile": analysis_result.get("profile", "Self"),
            "symptoms": symptoms,
            "age": age,
            "gender": gender,
            "doctor": analysis_result.get("doctor"),
            "risk": analysis_result.get("risk"),
            "risk_score": analysis_result.get("risk_score", 0),
            "risk_reasons": analysis_result.get("risk_reasons", []),
            "advice": analysis_result.get("advice"),
            "matched_symptom": analysis_result.get("matched_symptom"),
            "home_remedies": analysis_result.get("home_remedies"),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Store in mock memory
        PredictionRepository._mock_predictions.append(record)
        
        if db is None:
            logger.warning("Database connection unavailable. Saved prediction to in-memory store.")
            return record_id
        try:
            # Create a copy without the string _id so Mongo creates its own ObjectId
            mongo_record = record.copy()
            del mongo_record["_id"]
            result = db.predictions.insert_one(mongo_record)
            logger.info(f"Saved prediction history with ID: {result.inserted_id} for user {email}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to save prediction to MongoDB: {e}")
            return record_id

    @staticmethod
    def get_by_user(email: str, limit: int = 10, profile: Optional[str] = None) -> List[Dict[str, Any]]:
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        
        if db is None:
            user_preds = [p for p in PredictionRepository._mock_predictions if p["email"] == email_key]
            if profile:
                user_preds = [p for p in user_preds if p.get("profile", "Self") == profile]
            user_preds.sort(key=lambda x: x["timestamp"], reverse=True)
            return user_preds[:limit]
        try:
            query = {"email": email_key}
            if profile:
                query["profile"] = profile
            cursor = db.predictions.find(query).sort("timestamp", -1).limit(limit)
            predictions = []
            for doc in cursor:
                doc["_id"] = str(doc["_id"])
                predictions.append(doc)
            return predictions
        except Exception as e:
            logger.error(f"Failed to retrieve predictions for user {email}: {e}")
            user_preds = [p for p in PredictionRepository._mock_predictions if p["email"] == email_key]
            if profile:
                user_preds = [p for p in user_preds if p.get("profile", "Self") == profile]
            user_preds.sort(key=lambda x: x["timestamp"], reverse=True)
            return user_preds[:limit]



class ChatRepository:
    """Handles message saving and loading for the Wellness Assistant Chatbot with in-memory fallback."""
    _mock_chats: List[Dict[str, Any]] = []

    @staticmethod
    def save_message(email: str, role: str, content: str, file_name: Optional[str] = None) -> Optional[str]:
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        record_id = str(uuid.uuid4())
        record = {
            "_id": record_id,
            "email": email_key,
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        }
        if file_name:
            record["file_name"] = file_name
            
        # Store in mock memory
        ChatRepository._mock_chats.append(record)
        
        if db is None:
            logger.warning("Database connection unavailable. Saved chat message to in-memory store.")
            return record_id
        try:
            mongo_record = record.copy()
            del mongo_record["_id"]
            result = db.chat_logs.insert_one(mongo_record)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to save chat message to MongoDB: {e}")
            return record_id

    @staticmethod
    def get_history_by_user(email: str, limit: int = 50) -> List[Dict[str, Any]]:
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        
        if db is None:
            user_chats = [c for c in ChatRepository._mock_chats if c["email"] == email_key]
            user_chats.sort(key=lambda x: x["timestamp"])
            return user_chats[:limit]
        try:
            cursor = db.chat_logs.find({"email": email_key}).sort("timestamp", 1).limit(limit)
            messages = []
            for doc in cursor:
                doc["_id"] = str(doc["_id"])
                messages.append(doc)
            return messages
        except Exception as e:
            logger.error(f"Failed to retrieve chat history for user {email}: {e}")
            user_chats = [c for c in ChatRepository._mock_chats if c["email"] == email_key]
            user_chats.sort(key=lambda x: x["timestamp"])
            return user_chats[:limit]


class LabReportRepository:
    """Handles data operations for Lab Reports with in-memory fallback."""
    _mock_lab_reports: List[Dict[str, Any]] = []

    @staticmethod
    def save(email: str, profile: str, metrics: Dict[str, float], analysis_result: Dict[str, Any]) -> str:
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        record_id = str(uuid.uuid4())
        record = {
            "_id": record_id,
            "email": email_key,
            "profile": profile,
            "metrics": metrics,
            "analysis": analysis_result,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        LabReportRepository._mock_lab_reports.append(record)
        
        if db is None:
            logger.warning("Database offline. Saved lab report to in-memory store.")
            return record_id
        try:
            mongo_record = record.copy()
            del mongo_record["_id"]
            result = db.lab_reports.insert_one(mongo_record)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to save lab report to MongoDB: {e}")
            return record_id

    @staticmethod
    def get_by_user(email: str, profile: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        
        if db is None:
            reports = [r for r in LabReportRepository._mock_lab_reports if r["email"] == email_key]
            if profile:
                reports = [r for r in reports if r.get("profile", "Self") == profile]
            reports.sort(key=lambda x: x["timestamp"], reverse=True)
            return reports[:limit]
        try:
            query = {"email": email_key}
            if profile:
                query["profile"] = profile
            cursor = db.lab_reports.find(query).sort("timestamp", -1).limit(limit)
            reports = []
            for doc in cursor:
                doc["_id"] = str(doc["_id"])
                reports.append(doc)
            return reports
        except Exception as e:
            logger.error(f"Failed to retrieve lab reports: {e}")
            reports = [r for r in LabReportRepository._mock_lab_reports if r["email"] == email_key]
            if profile:
                reports = [r for r in reports if r.get("profile", "Self") == profile]
            reports.sort(key=lambda x: x["timestamp"], reverse=True)
            return reports[:limit]

    @staticmethod
    def delete(report_id: str, email: str) -> bool:
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        
        # Remove from mock
        initial_len = len(LabReportRepository._mock_lab_reports)
        LabReportRepository._mock_lab_reports = [
            r for r in LabReportRepository._mock_lab_reports 
            if not (r["_id"] == report_id and r["email"] == email_key)
        ]
        mock_deleted = len(LabReportRepository._mock_lab_reports) < initial_len
        
        if db is None:
            return mock_deleted
        try:
            from bson.objectid import ObjectId
            try:
                oid = ObjectId(report_id)
                res = db.lab_reports.delete_one({"_id": oid, "email": email_key})
            except Exception:
                res = db.lab_reports.delete_one({"_id": report_id, "email": email_key})
            return res.deleted_count > 0 or mock_deleted
        except Exception as e:
            logger.error(f"Failed to delete lab report {report_id}: {e}")
            return mock_deleted


class MedicalFileRepository:
    """Handles metadata operations for Medical Report files with in-memory fallback."""
    _mock_medical_reports: List[Dict[str, Any]] = []

    @staticmethod
    def save(email: str, profile: str, file_name: str, file_path: str, content_type: str, file_size: int) -> str:
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        record_id = str(uuid.uuid4())
        record = {
            "_id": record_id,
            "email": email_key,
            "profile": profile,
            "file_name": file_name,
            "file_path": file_path,
            "content_type": content_type,
            "file_size": file_size,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        MedicalFileRepository._mock_medical_reports.append(record)
        
        if db is None:
            logger.warning("Database offline. Saved medical report metadata to in-memory store.")
            return record_id
        try:
            mongo_record = record.copy()
            del mongo_record["_id"]
            result = db.medical_reports.insert_one(mongo_record)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to save medical report metadata to MongoDB: {e}")
            return record_id

    @staticmethod
    def get_by_user(email: str, profile: Optional[str] = None) -> List[Dict[str, Any]]:
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        
        if db is None:
            reports = [r for r in MedicalFileRepository._mock_medical_reports if r["email"] == email_key]
            if profile:
                reports = [r for r in reports if r.get("profile", "Self") == profile]
            reports.sort(key=lambda x: x["timestamp"], reverse=True)
            return reports
        try:
            query = {"email": email_key}
            if profile:
                query["profile"] = profile
            cursor = db.medical_reports.find(query).sort("timestamp", -1)
            reports = []
            for doc in cursor:
                doc["_id"] = str(doc["_id"])
                reports.append(doc)
            return reports
        except Exception as e:
            logger.error(f"Failed to retrieve medical reports: {e}")
            reports = [r for r in MedicalFileRepository._mock_medical_reports if r["email"] == email_key]
            if profile:
                reports = [r for r in reports if r.get("profile", "Self") == profile]
            reports.sort(key=lambda x: x["timestamp"], reverse=True)
            return reports

    @staticmethod
    def get_by_id(report_id: str, email: str) -> Optional[Dict[str, Any]]:
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        
        if db is None:
            for r in MedicalFileRepository._mock_medical_reports:
                if r["_id"] == report_id and r["email"] == email_key:
                    return r
            return None
        try:
            from bson.objectid import ObjectId
            try:
                oid = ObjectId(report_id)
                doc = db.medical_reports.find_one({"_id": oid, "email": email_key})
            except Exception:
                doc = db.medical_reports.find_one({"_id": report_id, "email": email_key})
            if doc:
                doc["_id"] = str(doc["_id"])
                return doc
            # Try mock fallback
            for r in MedicalFileRepository._mock_medical_reports:
                if r["_id"] == report_id and r["email"] == email_key:
                    return r
            return None
        except Exception as e:
            logger.error(f"Failed to retrieve medical report by ID {report_id}: {e}")
            for r in MedicalFileRepository._mock_medical_reports:
                if r["_id"] == report_id and r["email"] == email_key:
                    return r
            return None

    @staticmethod
    def delete(report_id: str, email: str) -> Optional[str]:
        """Deletes from DB/mock and returns physical file path to delete from disk."""
        db = DatabaseConnection.get_db()
        email_key = email.strip().lower()
        
        file_path_to_delete = None
        
        # Find in mock
        for r in MedicalFileRepository._mock_medical_reports:
            if r["_id"] == report_id and r["email"] == email_key:
                file_path_to_delete = r["file_path"]
                break
                
        # Remove from mock
        MedicalFileRepository._mock_medical_reports = [
            r for r in MedicalFileRepository._mock_medical_reports 
            if not (r["_id"] == report_id and r["email"] == email_key)
        ]
        
        if db is None:
            return file_path_to_delete
        try:
            from bson.objectid import ObjectId
            doc = None
            try:
                oid = ObjectId(report_id)
                doc = db.medical_reports.find_one({"_id": oid, "email": email_key})
                if doc:
                    file_path_to_delete = doc.get("file_path")
                    db.medical_reports.delete_one({"_id": oid, "email": email_key})
            except Exception:
                doc = db.medical_reports.find_one({"_id": report_id, "email": email_key})
                if doc:
                    file_path_to_delete = doc.get("file_path")
                    db.medical_reports.delete_one({"_id": report_id, "email": email_key})
            return file_path_to_delete
        except Exception as e:
            logger.error(f"Failed to delete medical report {report_id}: {e}")
            return file_path_to_delete

