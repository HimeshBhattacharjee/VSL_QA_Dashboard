from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    name: str
    employeeId: str
    phone: Optional[str] = None
    role: str = "Operator"
    password: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    name: str
    employeeId: str
    phone: Optional[str] = None
    role: str
    status: str
    avatar: str
    isDefaultPassword: bool
    createdAt: str
    signature: Optional[str] = None
    theme: str = "light"
    password: Optional[str] = None

class LoginRequest(BaseModel):
    employeeId: str
    password: str

class LoginResponse(BaseModel):
    id: str
    name: str
    employeeId: str
    role: str
    isDefaultPassword: bool
    signature: Optional[str] = None

    class Config:
        exclude_none = True

class PasswordChangeRequest(BaseModel):
    employeeId: str
    oldPassword: Optional[str] = None
    newPassword: str
    isFirstLogin: bool = False

class SignatureUpdateRequest(BaseModel):
    employeeId: str
    signature: Optional[str] = None
