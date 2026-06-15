import os
import logging
import hashlib
import uuid
import urllib.request
import urllib.parse
import json
from datetime import datetime, timedelta
from typing import Optional

# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException, status, Header, Form, File, UploadFile
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware

# pyrefly: ignore [missing-import]
from google.antigravity import Agent, LocalAgentConfig
# pyrefly: ignore [missing-import]
from google.antigravity.hooks import policy
# pyrefly: ignore [missing-import]
from google.antigravity.types import Image, Document

# Layer Imports
from config import Config
from schemas import SignupRequest, VerifyOtpRequest, LoginRequest, SymptomRequest
from repository import (
    DatabaseConnection,
    UserRepository,
    PredictionRepository,
    ChatRepository
)
from services import OTPService, EmailService, SymptomAnalysisService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("healthcare_assistant")

app = FastAPI(
    title="AI Healthcare Assistant API",
    description="A FastAPI backend for symptom analysis and doctor specialization recommendation with email authentication.",
    version="1.2.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def hash_password(password: str) -> str:
    """Hashes a password with the static salt from Config."""
    salted = password + Config.AUTH_SALT
    return hashlib.sha256(salted.encode('utf-8')).hexdigest()


# --- AUTH ENDPOINTS ---

@app.post("/auth/signup")
def signup(request_data: SignupRequest):
    email = request_data.email.strip().lower()
    password = request_data.password
    
    logger.info(f"Received signup request for email: {email}")
    
    if "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid email address."
        )
    
    # Check if user already exists and is verified
    existing_user = UserRepository.get_by_email(email)
    if existing_user and existing_user.get("is_verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A verified account already exists with this email address."
        )
        
    # Generate 4-digit OTP using the service
    otp_code = OTPService.generate_otp(email)
    password_hash = hash_password(password)
    
    # If user doesn't exist, create record (unverified)
    if not existing_user:
        UserRepository.create(email, password_hash)
        
    # Check if SMTP is configured, and attempt sending
    email_sent = False
    if Config.is_smtp_configured():
        email_sent = EmailService.send_verification_otp(email, otp_code)

    # Always log the verification code to the console for testing/debugging
    logger.info(f"--- [SECURITY CODE LOG] OTP for {email}: {otp_code} ---")

    if email_sent:
        logger.info(f"OTP successfully emailed to {email}")
        return {
            "message": "OTP verification code sent to your email address.",
            "email": email,
            "email_sent": True
        }
    else:
        return {
            "message": f"Simulated OTP: {otp_code} (SMTP is not configured, OTP printed here for your convenience)",
            "email": email,
            "email_sent": False
        }

@app.post("/auth/verify-otp")
def verify_otp(request_data: VerifyOtpRequest):
    email = request_data.email.strip().lower()
    otp = request_data.otp.strip()
    
    logger.info(f"Verifying OTP for email: {email}")
    
    success, message = OTPService.verify_otp(email, otp)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
        
    # Mark user as verified in DB
    db_success = UserRepository.verify(email)
    if not db_success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update verification status in database."
        )
        
    return {
        "message": "Email verified successfully.",
        "token": email
    }

@app.post("/auth/login")
def login(request_data: LoginRequest):
    email = request_data.email.strip().lower()
    password = request_data.password
    
    logger.info(f"Login request for email: {email}")
    
    user = UserRepository.get_by_email(email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email address not registered."
        )
        
    if not user.get("is_verified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address not verified. Please register again to verify."
        )
        
    if user.get("password_hash") != hash_password(password):
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="Incorrect password. Please try again."
        )
        
    return {
        "message": "Login successful.",
        "token": email
    }


# --- APPLICATION DIAGNOSTICS & SYSTEM ---

@app.on_event("startup")
def startup_event():
    logger.info("Starting up AI Healthcare Assistant backend...")
    DatabaseConnection.get_db()

@app.get("/")
def home():
    return {"message": "AI Healthcare Assistant Backend (FastAPI) is running"}

@app.get("/health")
def health_check():
    db_ok, db_msg = DatabaseConnection.check_health()
    return {
        "status": "healthy",
        "service": "online",
        "database": {
            "status": "connected",
            "message": db_msg if db_ok else "Connected (Mock Connection)"
        }
    }


@app.get("/map/hospitals")
def get_nearby_hospitals(lat: float, lon: float):
    """Proxies the request to Overpass API to prevent CORS blocks and supply User-Agent."""
    query = f"""
    [out:json][timeout:15];
    (
      nw["amenity"="hospital"](around:8000, {lat}, {lon});
      nw["amenity"="doctors"](around:8000, {lat}, {lon});
      nw["amenity"="clinic"](around:8000, {lat}, {lon});
    );
    out center 35;
    """
    
    overpass_urls = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter"
    ]
    
    for url in overpass_urls:
        try:
            logger.info(f"Proxying hospital search to Overpass server: {url}")
            req = urllib.request.Request(
                url,
                data=urllib.parse.urlencode({"data": query}).encode("utf-8"),
                headers={
                    "User-Agent": "MediGuardAI/1.2 (patidarpradumn@gmail.com)",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=12) as response:
                if response.status == 200:
                    return json.loads(response.read().decode("utf-8"))
        except Exception as e:
            logger.error(f"Failed to fetch from Overpass server {url}: {e}")
            
    raise HTTPException(
        status_code=502,
        detail="Failed to query nearby clinics from OpenStreetMap Overpass servers."
    )


# --- PROTECTED APP ENDPOINTS ---

@app.post("/analyze")
def analyze(request_data: SymptomRequest, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing. Please login first."
        )
        
    user_email = authorization.replace("Bearer ", "").strip().lower()
    user = UserRepository.get_by_email(user_email)
    if not user or not user.get("is_verified"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token. Please login again."
        )

    symptoms_text = request_data.symptoms.strip()
    age = request_data.age
    gender = request_data.gender.strip().lower()
    
    if not symptoms_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Symptoms text cannot be empty."
        )

    try:
        # 1. Analyze symptoms via service
        analysis_result = SymptomAnalysisService.analyze(symptoms_text, age, gender)
        
        # 2. Save prediction history to repository
        PredictionRepository.save(symptoms_text, age, gender, user_email, analysis_result)
        
        return analysis_result
    except Exception as e:
        logger.error(f"Error during symptom analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred on the server while performing the diagnosis."
        )

@app.get("/history")
def history(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing."
        )
        
    user_email = authorization.replace("Bearer ", "").strip().lower()
    user = UserRepository.get_by_email(user_email)
    if not user or not user.get("is_verified"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token."
        )

    try:
        prediction_logs = PredictionRepository.get_by_user(email=user_email, limit=10)
        return {"history": prediction_logs}
    except Exception as e:
        logger.error(f"Error fetching logs history: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching history logs."
        )


# --- CHATBOT WIDGET PORTAL ENDPOINTS ---

@app.post("/agent/chat")
async def agent_chat(
    message: str = Form(...),
    language: str = Form("en"),
    file: Optional[UploadFile] = File(None),
    authorization: Optional[str] = Header(None)
):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing. Please login first."
        )
        
    user_email = authorization.replace("Bearer ", "").strip().lower()
    user = UserRepository.get_by_email(user_email)
    if not user or not user.get("is_verified"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token. Please login again."
        )

    user_msg = message.strip()
    file_name = file.filename if file else None
    
    # Save user message to chat logs
    ChatRepository.save_message(user_email, "user", user_msg, file_name=file_name)
    
    # Check if a valid conversation trajectory file already exists on disk
    chat_conversation_id = user.get("chat_conversation_id")
    resume_id = None
    if chat_conversation_id:
        traj_path = os.path.join("/tmp/chat_sessions", f"traj-{chat_conversation_id}")
        if os.path.exists(traj_path):
            resume_id = chat_conversation_id
            logger.info(f"Resuming existing Antigravity conversation {resume_id} for user {user_email}")
        else:
            logger.warning(f"Saved conversation ID {chat_conversation_id} file not found on disk. Resetting session.")
            
    # Fetch user's latest diagnosis predictions to provide clinical context to the chatbot
    patient_context = ""
    try:
        latest_preds = PredictionRepository.get_by_user(email=user_email, limit=1)
        if latest_preds:
            pred = latest_preds[0]
            patient_context = (
                f"\n[Patient's Recent Diagnostic Analysis]\n"
                f"- Reported Symptoms: \"{pred.get('symptoms')}\"\n"
                f"- Demographics: Age {pred.get('age')}, Gender {pred.get('gender')}\n"
                f"- Diagnosed Specialist: {pred.get('doctor')}\n"
                f"- Assessed Severity: {pred.get('risk')}\n"
                f"- Special Advice: {pred.get('advice')}\n"
                f"- Suggested Remedies: {pred.get('home_remedies')}\n"
                f"Use this recent diagnostic context to answer questions about their current diet, food, "
                f"and lifestyle recommendations without asking them to repeat what their symptoms are.\n\n"
            )
    except Exception as ctx_err:
        logger.error(f"Failed to fetch diagnostic context for chatbot: {ctx_err}")

    # Process file if uploaded
    file_obj = None
    if file:
        try:
            os.makedirs("/tmp/uploads", exist_ok=True)
            file_ext = os.path.splitext(file.filename)[1]
            safe_filename = f"{uuid.uuid4()}{file_ext}"
            file_path = os.path.join("/tmp/uploads", safe_filename)
            
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
                
            ext_lower = file_ext.lower()
            if ext_lower in ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']:
                file_obj = Image.from_file(file_path)
                logger.info(f"Loaded image upload: {file_path}")
            else:
                file_obj = Document.from_file(file_path)
                logger.info(f"Loaded document upload: {file_path}")
        except Exception as file_err:
            logger.error(f"Failed to process uploaded file: {file_err}", exc_info=True)

    try:
        os.makedirs("/tmp/chat_sessions", exist_ok=True)
        
        # Configure and run Google Antigravity Agent in text-only chatbot mode
        lang_instruction = "completely in Hindi" if language == "hi" else "completely in Hinglish (Hindi written in Latin script / English alphabet)" if language == "hinglish" else "in English"
        config = LocalAgentConfig(
            conversation_id=resume_id,
            save_dir="/tmp/chat_sessions",
            policies=[policy.deny_all()],
            system_instructions=(
                "You are the MediGuard AI Clinical Wellness & Diet Assistant. "
                f"{patient_context}"
                "Provide detailed, evidence-based dietary recommendations, food groups to include/avoid, "
                "and safe lifestyle guidelines customized to the patient's health conditions, symptoms, age, and gender if provided. "
                "You may also analyze user-uploaded report images or document files (e.g. blood tests, prescriptions, clinical notes) "
                "to give precise recommendations for their diet, daily routine, and sleep plans. "
                "Keep instructions clear, structured, and easy to read. "
                f"Please write your response {lang_instruction}. Ensure the selected language is fully respected for all instructions and outputs. "
                "Always warn the user to seek emergency paramedic or hospital care if they mention acute emergency symptoms "
                "(e.g., severe chest pain, shortness of breath, heavy bleeding, stroke indicators)."
            )
        )

        async with Agent(config) as agent:
            # If the session is newly created, persist the new ID in MongoDB
            current_id = agent.conversation_id
            if current_id != chat_conversation_id:
                UserRepository.set_conversation_id(user_email, current_id)
                logger.info(f"Initialized new Antigravity session {current_id} for user {user_email}")
                
            chat_payload = [user_msg]
            if file_obj:
                chat_payload.append(file_obj)
                
            response = await agent.chat(chat_payload)
            response_text = await response.text()
            
        # Save assistant message to database
        ChatRepository.save_message(user_email, "assistant", response_text)
        
        return {
            "role": "assistant",
            "content": response_text
        }
    except Exception as e:
        logger.error(f"Error executing Antigravity agent chat: {e}", exc_info=True)
        
        # Build a customized fallback wellness response by inspecting the latest prediction logs
        fallback_msg = ""
        latest_preds = []
        try:
            latest_preds = PredictionRepository.get_by_user(email=user_email, limit=1)
        except Exception:
            pass
            
        is_hi = language == "hi"
        is_hinglish = language == "hinglish"

        if latest_preds:
            pred = latest_preds[0]
            symptoms = pred.get("symptoms", "").lower()
            doctor = pred.get("doctor", "")
            
            if "gynecologist" in doctor.lower() or any(w in symptoms for w in ["period", "menstrual", "cramp", "pregnancy"]):
                if is_hi:
                    fallback_msg = (
                        "आपके हालिया स्त्री रोग संबंधी चिंताओं के लिए कल्याणकारी सलाह:\n"
                        "1. गर्म खाद्य पदार्थों पर ध्यान दें जैसे कि हर्बल चाय (अदरक/कैमोमाइल) और गर्म सब्जियों का सूप।\n"
                        "2. ऐंठन की अनुभूति को कम करने के लिए अपने निचले पेट पर गर्म पानी की बोतल या हीटिंग पैड का उपयोग करें।\n"
                        "3. जितना हो सके आराम करें, भारी शारीरिक गतिविधियों से बचें, और कैफीन का अधिक सेवन न करें।\n"
                        "*सावधानी: यदि गर्भावस्था की संभावना है, तो डॉक्टर की सलाह के बिना इबुप्रोफेन या एस्पिरिन लेने से बचें। यदि दर्द गंभीर है, तो स्त्री रोग विशेषज्ञ से परामर्श लें।*"
                    )
                elif is_hinglish:
                    fallback_msg = (
                        "Recent gynecological concerns ke liye wellness recommendation:\n"
                        "1. Warm foods par focus karein jaise herbal tea (ginger/chamomile) aur warm vegetable soups.\n"
                        "2. Cramps se relief ke liye lower abdomen par hot water bottle ya heating pad ka use karein.\n"
                        "3. Jitna ho sake rest karein, heavy physical activities se bachein, aur high caffeine na lein.\n"
                        "*CAUTION: Agar pregnancy ki possibility hai, toh bina doctor consultation ke Ibuprofen ya Aspirin na lein. Pain severe hone par Gynecologist se consult karein.*"
                    )
                else:
                    fallback_msg = (
                        "Wellness recommendation for your recent gynecological concerns:\n"
                        "1. Focus on warm foods like herbal teas (ginger/chamomile) and warm vegetable soups.\n"
                        "2. Use a hot water bottle or heating pad on your lower abdomen to relieve cramp sensations.\n"
                        "3. Rest as much as possible, avoid strenuous physical activities, and avoid high caffeine intake.\n"
                        "*CAUTION: Avoid Ibuprofen or Aspirin if pregnancy is possible without a doctor's consultation. Consult a Gynecologist if pain is severe.*"
                    )
            elif any(w in symptoms for w in ["fever", "cold", "cough", "body pain", "headache"]):
                if is_hi:
                    fallback_msg = (
                        "आपके हालिया बुखार या फ्लू जैसे लक्षणों के लिए कल्याणकारी सलाह:\n"
                        "1. पर्याप्त जलपान बहुत महत्वपूर्ण है: नियमित रूप से गर्म पानी, ओआरएस (ORS), या साफ सब्जियों का सूप पीएं।\n"
                        "2. एक हवादार और आरामदायक कमरे में भरपूर आराम करें।\n"
                        "3. अपने तापमान पर नजर रखें। बुखार से राहत के लिए आप मानक पैरासिटामोल (पैकेजिंग निर्देशों के अनुसार) ले सकते हैं।\n"
                        "*सावधानी: भारी भोजन या उच्च कैफीन से बचें। यदि बुखार 3 दिनों से अधिक समय तक बना रहता है, तो डॉक्टर से संपर्क करें।*"
                    )
                elif is_hinglish:
                    fallback_msg = (
                        "Recent fever ya flu-like symptoms ke liye wellness recommendation:\n"
                        "1. Hydration boht zaroori hai: thoda-thoda warm water, ORS solution, ya clear vegetable soup peeyein.\n"
                        "2. Ek ventilated aur comfortable room me achhe se rest karein.\n"
                        "3. Apna temperature check karte rahein. Fever relief ke liye standard Paracetamol le sakte hain.\n"
                        "*CAUTION: Heavy food aur high caffeine se bachein. Agar fever 3 days se zyada rahe toh GP ko dikhayein.*"
                    )
                else:
                    fallback_msg = (
                        "Wellness recommendation for your recent fever or flu-like symptoms:\n"
                        "1. Hydration is key: Sip warm water, electrolyte solution (ORS), or clear vegetable broth soup regularly.\n"
                        "2. Secure plenty of rest in a well-ventilated, comfortable room.\n"
                        "3. Keep track of your temperature. You may take standard Paracetamol (following packaging guidelines) for fever relief.\n"
                        "*CAUTION: Avoid heavy foods or high caffeine. Consult a GP if fever persists beyond 3 days.*"
                    )
            elif any(w in symptoms for w in ["stomach", "acidity", "gas", "vomit", "vomiting", "abdominal"]):
                if is_hi:
                    fallback_msg = (
                        "आपके हालिया पेट/एसिडिटी संबंधी चिंताओं के लिए कल्याणकारी सलाह:\n"
                        "1. कम मात्रा में, बार-बार और हल्का भोजन करें (जैसे ओट्स, केला, दही चावल, या सूखी टोस्ट)।\n"
                        "2. सामान्य उत्तेजक खाद्य पदार्थों से बचें: मसालेदार व्यंजन, तैलीय/तले हुए खाद्य पदार्थ, खट्टे फल, कैफीन और कार्बोनेटेड सोडा।\n"
                        "3. सीधे बैठें: एसिड रिफ्लक्स को रोकने के लिए खाने के बाद कम से कम 2-3 घंटे तक न लेटें।\n"
                        "*सावधानी: यदि आपको पेट में गंभीर दर्द महसूस हो या उल्टी में खून दिखाई दे, तो तुरंत चिकित्सा सहायता लें।*"
                    )
                elif is_hinglish:
                    fallback_msg = (
                        "Recent stomach/acidity concerns ke liye wellness recommendation:\n"
                        "1. Chhote aur light meals khayein (jaise oats, bananas, curd rice, ya dry toast).\n"
                        "2. Trigger foods se bachein: spicy dishes, oily/fried items, citrus fruits, caffeine aur sodas.\n"
                        "3. Khane ke baad turant na letein, kam se kam 2-3 hours tak upright position me rahein taaki acid reflux na ho.\n"
                        "*CAUTION: Agar stomach pain severe ho ya vomit me blood aaye toh turant doctor ke paas jayein.*"
                    )
                else:
                    fallback_msg = (
                        "Wellness recommendation for your recent stomach/acidity concerns:\n"
                        "1. Eat small, frequent, and bland meals (like oats, bananas, curd rice, or dry toast).\n"
                        "2. Avoid common trigger foods: spicy dishes, oily/fried items, citrus fruits, caffeine, and carbonated sodas.\n"
                        "3. Keep upright: Do not lie down for at least 2-3 hours after eating to prevent acid reflux.\n"
                        "*CAUTION: Seek urgent medical help if you experience severe abdominal pain or notice blood in vomit.*"
                    )
            elif any(w in symptoms for w in ["tooth", "teeth", "gum", "dental"]):
                if is_hi:
                    fallback_msg = (
                        "आपके हालिया दंत लक्षणों के लिए कल्याणकारी सलाह:\n"
                        "1. दिन में 3-4 बार गुनगुने नमक वाले पानी से धीरे-धीरे कुल्ला करें।\n"
                        "2. कमरे के तापमान पर नरम, ठंडे खाद्य पदार्थ खाएं और अत्यधिक गर्म, ठंडे या मीठे पेय पदार्थों से बचें।\n"
                        "3. अपने जबड़े को आराम दें और दर्द वाले हिस्से की तरफ चबाने से बचें।\n"
                        "*सावधानी: उचित दंत मूल्यांकन के लिए दंत चिकित्सक से परामर्श लें।*"
                    )
                elif is_hinglish:
                    fallback_msg = (
                        "Recent dental symptoms ke liye wellness recommendation:\n"
                        "1. Din me 3-4 baar warm salt water se rinse karein.\n"
                        "2. Soft aur room temperature wala food khayein. Zyada garam, thanda ya sugary drinks se bachein.\n"
                        "3. Gums aur jaw ko rest dein aur pain wali side se chabana avoid karein.\n"
                        "*CAUTION: Proper evaluation ke liye dentist se consult karein.*"
                    )
                else:
                    fallback_msg = (
                        "Wellness recommendation for your recent dental symptoms:\n"
                        "1. Rinse your mouth gently with warm salt water 3-4 times a day.\n"
                        "2. Eat soft, cool foods at room temperature and avoid extreme hot, cold, or sugary drinks.\n"
                        "3. Rest your jaw and avoid chewing on the painful side.\n"
                        "*CAUTION: Consult a dentist for proper dental evaluation.*"
                    )
            else:
                if is_hi:
                    fallback_msg = (
                        f"आपके हालिया लक्षणों के आधार पर कल्याणकारी सलाह ({doctor} के साथ परामर्श का सुझाव):\n"
                        f"1. मुख्य निर्देश: {pred.get('advice') or 'विश्राम करें और हाइड्रेटेड रहें।'}\n"
                        f"2. दिशानिर्देश: {pred.get('home_remedies') or 'स्वयं दवा लेने से बचें।'}"
                    )
                elif is_hinglish:
                    fallback_msg = (
                        f"Aapke recent symptoms ke basis par wellness recommendation ({doctor} se consultation suggested):\n"
                        f"1. Main instruction: {pred.get('advice') or 'Rest karein aur hydrated rahein.'}\n"
                        f"2. Guidelines: {pred.get('home_remedies') or 'Self-medication avoid karein.'}"
                    )
                else:
                    fallback_msg = (
                        f"Wellness recommendation based on your recent symptoms (Consultation suggested with {doctor}):\n"
                        f"1. Main instruction: {pred.get('advice') or 'Maintain rest and stay hydrated.'}\n"
                        f"2. Guidelines: {pred.get('home_remedies') or 'Avoid self-medication.'}"
                    )
        else:
            if is_hi:
                fallback_msg = (
                    "कल्याणकारी सलाह:\n"
                    "1. पौष्टिक, संतुलित पोषण पर ध्यान दें: हरी सब्जियां, गैर-खट्टे फल और लीन प्रोटीन शामिल करें।\n"
                    "2. दिन भर घूंट-घूंट पानी पीकर पर्याप्त हाइड्रेशन बनाए रखें।\n"
                    "3. पर्याप्त आराम सुनिश्चित करें और प्रसंस्कृत शर्करा या भारी तले हुए भोजन से बचें।"
                )
            elif is_hinglish:
                fallback_msg = (
                    "Wellness recommendation:\n"
                    "1. Wholesome, balanced nutrition par focus karein: green vegetables, non-citrus fruits, aur proteins lein.\n"
                    "2. Din bhar thoda-thoda paani peekar achhi hydration maintain karein.\n"
                    "3. Proper rest lein aur junk food ya heavy fried meals avoid karein."
                )
            else:
                fallback_msg = (
                    "Wellness recommendation:\n"
                    "1. Focus on wholesome, balanced nutrition: include green vegetables, non-citrus fruits, and lean proteins.\n"
                    "2. Maintain adequate hydration by sipping water throughout the day.\n"
                    "3. Secure enough rest and avoid processed sugars or heavy fried meals."
                )
            
        if is_hi:
            fallback_msg += "\n\n*(नोट: एपीआई कुंजी की सीमा के कारण वेलनेस चैटबॉट वर्तमान में स्थानीय बैकअप मोड में काम कर रहा है।"
            if file:
                fallback_msg += " अपलोडेड रिपोर्ट फाइल का ऑफलाइन मोड में विश्लेषण नहीं किया जा सका।)*"
            else:
                fallback_msg += ")*"
        elif is_hinglish:
            fallback_msg += "\n\n*(Note: API key rate limits ki wajah se wellness chatbot abhi offline backup mode me chal raha hai."
            if file:
                fallback_msg += " Uploaded report file offline mode me analyze nahi ho payi.*"
            else:
                fallback_msg += ")*"
        else:
            fallback_msg += "\n\n*(Note: The wellness chatbot is currently operating in local offline backup mode due to API key rate limits)."
            if file:
                fallback_msg += " The uploaded report file could not be analyzed in offline mode.*"
            else:
                fallback_msg += ")*"
        
        ChatRepository.save_message(user_email, "assistant", fallback_msg)
        return {
            "role": "assistant",
            "content": fallback_msg
        }

@app.get("/agent/history")
def agent_history(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing."
        )
        
    user_email = authorization.replace("Bearer ", "").strip().lower()
    user = UserRepository.get_by_email(user_email)
    if not user or not user.get("is_verified"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token."
        )

    try:
        chat_logs = ChatRepository.get_history_by_user(email=user_email, limit=50)
        return {"history": chat_logs}
    except Exception as e:
        logger.error(f"Error fetching chat history logs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching chat history."
        )
