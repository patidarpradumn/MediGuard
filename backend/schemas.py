from pydantic import BaseModel, Field

class SignupRequest(BaseModel):
    email: str = Field(..., description="Email address")
    password: str = Field(..., min_length=6, description="Password, minimum 6 characters")

class VerifyOtpRequest(BaseModel):
    email: str = Field(..., description="Email address")
    otp: str = Field(..., min_length=4, max_length=4, description="4-digit OTP code")

class LoginRequest(BaseModel):
    email: str = Field(..., description="Email address")
    password: str = Field(..., description="Password")

class SymptomRequest(BaseModel):
    symptoms: str = Field(..., min_length=1, description="Symptom text")
    age: int = Field(30, ge=0, le=120, description="Patient age")
    gender: str = Field("male", description="Patient gender")
    profile: str = Field("Self", description="Associated family profile")

class LabReportRequest(BaseModel):
    profile: str = Field("Self", description="Associated family profile")
    hemoglobin: float = Field(..., description="Hemoglobin level in g/dL")
    wbc: float = Field(..., description="WBC count in cells/mcL")
    platelets: float = Field(..., description="Platelet count in cells/mcL")
    sugar: float = Field(..., description="Blood sugar level in mg/dL")
    vitamin_d: float = Field(..., description="Vitamin D level in ng/mL")
    cholesterol: float = Field(..., description="Total cholesterol level in mg/dL")
    creatinine: float = Field(..., description="Serum creatinine level in mg/dL")

