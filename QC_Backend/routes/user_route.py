from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from datetime import datetime
from bson import ObjectId
import os
import base64
from models.user_models import (
    UserCreate, UserResponse, LoginRequest, LoginResponse,
    PasswordChangeRequest, SignatureUpdateRequest
)
from users.user_db import users_collection, generate_password

user_router = APIRouter(prefix="/user", tags=["User Management"])

SIGNATURES_DIR = "signatures"
os.makedirs(SIGNATURES_DIR, exist_ok=True)

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
        "signature": None,
        "createdAt": datetime.now().isoformat()
    }
    result = users_collection.insert_one(user_data)
    user_data["id"] = str(result.inserted_id)
    return user_data

@user_router.get("/users", response_model=list[UserResponse])
async def get_users():
    users = list(users_collection.find({}))
    for user in users:
        user["id"] = str(user["_id"])
        if "_id" in user:
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
    
    # Only include signature for non-Admin users
    signature_data = user.get("signature") if user.get("role") != "Admin" else None
    
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "employeeId": user["employeeId"],
        "role": user["role"],
        "isDefaultPassword": user["isDefaultPassword"],
        "signature": signature_data
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

@user_router.patch("/users/{user_id}/status")
async def update_user_status(user_id: str):
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        new_status = "Inactive" if user["status"] == "Active" else "Active"
        
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"status": new_status}}
        )
        
        return {"message": f"User status updated to {new_status}", "newStatus": new_status}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid user ID")

@user_router.post("/signature/upload")
async def upload_signature(
    employeeId: str = Form(...),
    signature: UploadFile = File(...)
):
    try:
        if not signature.content_type or not signature.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400, 
                detail="File must be an image (JPEG, PNG, GIF)"
            )
        
        # Check if user exists
        user = users_collection.find_one({"employeeId": employeeId})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Remove old signature file if exists
        if user.get("signature"):
            old_signature_path = user["signature"].lstrip('/')
            if os.path.exists(old_signature_path):
                os.remove(old_signature_path)
        
        # Generate filename
        file_extension = os.path.splitext(signature.filename)[1]
        if not file_extension:
            file_extension = '.png'
        
        filename = f"signature_{employeeId}{file_extension}"
        file_path = os.path.join(SIGNATURES_DIR, filename)
        contents = await signature.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        with open(file_path, "wb") as f:
            f.write(contents)
        
        # Update user record with signature path
        signature_url = f"/signatures/{filename}"
        update_result = users_collection.update_one(
            {"employeeId": employeeId},
            {"$set": {"signature": signature_url}}
        )
        return {
            "message": "Signature uploaded successfully", 
            "signatureUrl": signature_url
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error uploading signature: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error uploading signature: {str(e)}")

@user_router.delete("/signature/remove/{employeeId}")
async def remove_signature(employeeId: str):
    try:
        user = users_collection.find_one({"employeeId": employeeId})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Remove signature file if exists
        if user.get("signature"):
            signature_path = user["signature"].lstrip('/')
            if os.path.exists(signature_path):
                os.remove(signature_path)
        
        # Update user record
        users_collection.update_one(
            {"employeeId": employeeId},
            {"$set": {"signature": None}}
        )
        
        return {"message": "Signature removed successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing signature: {str(e)}")

@user_router.get("/signature/{employeeId}")
async def get_signature(employeeId: str):
    user = users_collection.find_one({"employeeId": employeeId})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"signature": user.get("signature")}

@user_router.get("/current-user", response_model=UserResponse)
async def get_current_user(employeeId: str):
    """Get current user by employeeId"""
    try:
        user = users_collection.find_one({"employeeId": employeeId})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Convert to response model
        user_data = {
            "id": str(user["_id"]),
            "name": user["name"],
            "employeeId": user["employeeId"],
            "phone": user["phone"],
            "role": user["role"],
            "status": user["status"],
            "avatar": user["avatar"],
            "isDefaultPassword": user["isDefaultPassword"],
            "createdAt": user["createdAt"],
            "signature": user.get("signature")
        }
        return user_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user: {str(e)}")

@user_router.get("/current-user-by-name", response_model=UserResponse)
async def get_current_user_by_name(name: str):
    """Get current user by name"""
    try:
        user = users_collection.find_one({"name": name})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user_data = {
            "id": str(user["_id"]),
            "name": user["name"],
            "employeeId": user["employeeId"],
            "phone": user["phone"],
            "role": user["role"],
            "status": user["status"],
            "avatar": user["avatar"],
            "isDefaultPassword": user["isDefaultPassword"],
            "createdAt": user["createdAt"],
            "signature": user.get("signature")
        }
        return user_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user: {str(e)}")