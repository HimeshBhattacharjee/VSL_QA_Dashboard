from pydantic import BaseModel
from typing import Optional

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
    signature: Optional[str] = None
    theme: str = "light"
    password: str | None = None

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
    newPassword: str
    isFirstLogin: bool = False

class SignatureUpdateRequest(BaseModel):
    employeeId: str
    signature: Optional[str] = None