from fastapi import APIRouter, HTTPException
from datetime import datetime
from bson import ObjectId
from users.user_models import (
    UserCreate, UserResponse, LoginRequest, LoginResponse,
    PasswordChangeRequest, ForgotPasswordRequest, 
    VerifyOtpRequest, ResetPasswordRequest
)
from users.user_db import (users_collection, otp_storage, generate_password, generate_otp)

user_router = APIRouter(prefix="/user", tags=["User Management"])

@user_router.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate):
    existing_user = users_collection.find_one({"employeeId": user.employeeId})
    if existing_user:
        raise HTTPException(status_code=400, detail="Employee ID already exists")
    avatar = ''.join([word[0] for word in user.name.split()]).upper()
    user_data = {
        "name": user.name,
        "employeeId": user.employeeId,
        "phone": user.phone,
        "role": user.role,
        "password": user.password,
        "status": "Active",
        "avatar": avatar,
        "isDefaultPassword": True,
        "createdAt": datetime.now().isoformat()
    }
    result = users_collection.insert_one(user_data)
    user_data["id"] = str(result.inserted_id)
    return user_data

@user_router.get("/users", response_model=list[UserResponse])
async def get_users():
    users = list(users_collection.find({}, {"password": 0}))
    for user in users:
        user["id"] = str(user["_id"])
        del user["_id"]
    return users

@user_router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    try:
        result = users_collection.delete_one({"_id": ObjectId(user_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        return {"message": "User deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid user ID")

@user_router.post("/auth/login", response_model=LoginResponse)
async def login(login_data: LoginRequest):
    user = users_collection.find_one({
        "employeeId": login_data.employeeId,
        "password": login_data.password
    })
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user["status"] != "Active":
        raise HTTPException(status_code=401, detail="User account is inactive")
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "employeeId": user["employeeId"],
        "role": user["role"],
        "isDefaultPassword": user["isDefaultPassword"]
    }

@user_router.post("/auth/change-password")
async def change_password(password_data: PasswordChangeRequest):
    user = users_collection.find_one({"employeeId": password_data.employeeId})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = {
        "password": password_data.newPassword,
        "isDefaultPassword": False
    }
    users_collection.update_one(
        {"employeeId": password_data.employeeId},
        {"$set": update_data}
    )
    return {"message": "Password changed successfully"}

@user_router.post("/auth/forgot-password")
async def forgot_password(forgot_data: ForgotPasswordRequest):
    user = users_collection.find_one({
        "employeeId": forgot_data.employeeId,
        "phone": forgot_data.phone
    })
    if not user:
        raise HTTPException(status_code=404, detail="Employee ID and phone number do not match")
    otp = generate_otp()
    otp_storage[forgot_data.employeeId] = {
        "otp": otp,
        "timestamp": datetime.now()
    }
    # In production, send SMS with OTP
    print(f"OTP for {forgot_data.employeeId}: {otp}")  # Remove this in production
    return {"message": "OTP sent to your registered phone number"}

@user_router.post("/auth/verify-otp")
async def verify_otp(otp_data: VerifyOtpRequest):
    """Verify OTP for password reset"""
    stored_otp_data = otp_storage.get(otp_data.employeeId)
    if not stored_otp_data or stored_otp_data["otp"] != otp_data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    # Check if OTP is expired (5 minutes)
    if (datetime.now() - stored_otp_data["timestamp"]).total_seconds() > 300:
        del otp_storage[otp_data.employeeId]
        raise HTTPException(status_code=400, detail="OTP has expired")
    return {"message": "OTP verified successfully"}

@user_router.post("/auth/reset-password")
async def reset_password(reset_data: ResetPasswordRequest):
    stored_otp_data = otp_storage.get(reset_data.employeeId)
    if not stored_otp_data or stored_otp_data["otp"] != reset_data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    users_collection.update_one(
        {"employeeId": reset_data.employeeId},
        {"$set": {
            "password": reset_data.newPassword,
            "isDefaultPassword": False
        }}
    )
    del otp_storage[reset_data.employeeId]
    return {"message": "Password reset successfully"}