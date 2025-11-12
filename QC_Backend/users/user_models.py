from pydantic import BaseModel
from typing import List, Optional

class UserCreate(BaseModel):
    name: str
    employeeId: str
    phone: str
    role: str = "Operator"
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    employeeId: str
    phone: str
    role: str
    status: str
    avatar: str
    isDefaultPassword: bool
    createdAt: str

class LoginRequest(BaseModel):
    employeeId: str
    password: str

class LoginResponse(BaseModel):
    id: str
    name: str
    employeeId: str
    role: str
    isDefaultPassword: bool

class PasswordChangeRequest(BaseModel):
    employeeId: str
    newPassword: str
    isFirstLogin: bool = False

class ForgotPasswordRequest(BaseModel):
    employeeId: str
    phone: str

class VerifyOtpRequest(BaseModel):
    employeeId: str
    otp: str

class ResetPasswordRequest(BaseModel):
    employeeId: str
    newPassword: str
    otp: str