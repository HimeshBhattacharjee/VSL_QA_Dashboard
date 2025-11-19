from fastapi import APIRouter, HTTPException
from datetime import datetime
from bson import ObjectId
from users.user_models import (
    UserCreate, UserResponse, LoginRequest, LoginResponse,
    PasswordChangeRequest
)
from users.user_db import users_collection, generate_password

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
    
    # Validate password criteria
    new_password = password_data.newPassword
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    if not any(c.islower() for c in new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")
    if not any(c.isupper() for c in new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not any(c.isdigit() for c in new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one digit")
    if not any(c in "@#$&!_" for c in new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character (@, #, $, &, !, _)")
    
    update_data = {
        "password": new_password,
        "isDefaultPassword": False
    }
    users_collection.update_one(
        {"employeeId": password_data.employeeId},
        {"$set": update_data}
    )
    return {"message": "Password changed successfully"}