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
