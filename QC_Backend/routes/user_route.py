from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header
from fastapi.responses import StreamingResponse
from datetime import datetime
from bson import ObjectId
import logging
import os
import io
import base64
from urllib.parse import unquote, urlparse
from models.user_models import (
    UserCreate, UserResponse, LoginRequest, LoginResponse,
    PasswordChangeRequest, SignatureUpdateRequest, UserUpdate
)
from users.user_db import users_collection, generate_password

logger = logging.getLogger(__name__)

user_router = APIRouter(prefix="/api/user", tags=["User Management"])

MANAGEABLE_ROLES = {"Manager", "Supervisor", "Operator"}
SYSTEM_ADMIN_ROLES = {"Admin", "System Administrator"}
SIGNATURE_S3_PREFIX = "users/signatures/"

def extract_signature_key(signature_source: str | None) -> str | None:
    if not signature_source:
        return None

    source = signature_source.strip()
    if source.startswith(SIGNATURE_S3_PREFIX):
        return source

    if source.startswith(("http://", "https://")):
        parsed = urlparse(source)
        path_key = unquote(parsed.path.lstrip("/"))
        marker_index = path_key.find(SIGNATURE_S3_PREFIX)
        if marker_index >= 0:
            return path_key[marker_index:]

    return None

def is_system_admin(user: dict) -> bool:
    return user.get("role") in SYSTEM_ADMIN_ROLES

def require_admin_request(admin_employee_id: str | None) -> None:
    if not admin_employee_id:
        raise HTTPException(status_code=401, detail="Admin authorization is required")

    admin_user = users_collection.find_one({"employeeId": admin_employee_id.strip()})
    if not admin_user or admin_user.get("status") != "Active" or not is_system_admin(admin_user):
        raise HTTPException(status_code=403, detail="Only active administrators can edit users")

@user_router.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate):
    name = user.name.strip()
    employee_id = user.employeeId.strip()
    role = user.role.strip()

    existing_user = users_collection.find_one({"employeeId": employee_id})
    if existing_user:
        raise HTTPException(status_code=400, detail="Employee ID already exists")
    if role not in MANAGEABLE_ROLES:
        raise HTTPException(status_code=400, detail="Role must be Manager, Supervisor, or Operator")

    avatar = ''.join([word[0] for word in name.split() if word]).upper()
    user_data = {
        "name": name,
        "employeeId": employee_id,
        "role": role,
        "password": generate_password(name, employee_id),
        "status": "Active",
        "avatar": avatar,
        "isDefaultPassword": True,
        "signature": None,
        "theme": "light",
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
        object_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = users_collection.find_one({"_id": object_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if is_system_admin(user):
        raise HTTPException(status_code=403, detail="System Administrator cannot be deleted")

    users_collection.delete_one({"_id": object_id})
    return {"message": "User deleted successfully"}

@user_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_update: UserUpdate, x_admin_employee_id: str | None = Header(default=None)):
    require_admin_request(x_admin_employee_id)

    try:
        object_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    existing_user = users_collection.find_one({"_id": object_id})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")
    if is_system_admin(existing_user):
        raise HTTPException(status_code=403, detail="System Administrator users cannot be edited")

    name = user_update.name.strip()
    employee_id = user_update.employeeId.strip()
    role = user_update.role.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Employee Name is required")
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID is required")
    if role not in MANAGEABLE_ROLES:
        raise HTTPException(status_code=400, detail="Role must be Manager, Supervisor, or Operator")

    duplicate_user = users_collection.find_one({
        "employeeId": employee_id,
        "_id": {"$ne": object_id}
    })
    if duplicate_user:
        raise HTTPException(status_code=400, detail="Employee ID already exists")

    avatar = ''.join([word[0] for word in name.split() if word]).upper()
    update_data = {
        "name": name,
        "employeeId": employee_id,
        "role": role,
        "avatar": avatar,
    }
    # Password is intentionally preserved so employee ID edits do not reset login credentials.
    users_collection.update_one({"_id": object_id}, {"$set": update_data})

    updated_user = users_collection.find_one({"_id": object_id})
    updated_user["id"] = str(updated_user["_id"])
    del updated_user["_id"]
    return updated_user

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
    theme_value = user.get("theme", "light")
    
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "employeeId": user["employeeId"],
        "role": user["role"],
        "isDefaultPassword": user["isDefaultPassword"],
        "signature": signature_data,
        "theme": theme_value
    }

@user_router.post("/auth/change-password")
async def change_password(password_data: PasswordChangeRequest):
    user = users_collection.find_one({"employeeId": password_data.employeeId})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    current_password = user.get("password", "")
    old_password = password_data.oldPassword
    if not password_data.isFirstLogin and not old_password:
        raise HTTPException(status_code=400, detail="Old password is required")
    if old_password and old_password != current_password:
        raise HTTPException(status_code=401, detail="Old password is incorrect")

    # Validate password criteria
    new_password = password_data.newPassword
    if new_password == current_password:
        raise HTTPException(status_code=400, detail="New password cannot be the same as old password")
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
        object_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = users_collection.find_one({"_id": object_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if is_system_admin(user):
        raise HTTPException(status_code=403, detail="System Administrator status cannot be changed")

    new_status = "Inactive" if user["status"] == "Active" else "Active"

    users_collection.update_one(
        {"_id": object_id},
        {"$set": {"status": new_status}}
    )

    return {"message": f"User status updated to {new_status}", "newStatus": new_status}

@user_router.post("/signature/upload")
async def upload_signature(
    employeeId: str = Form(...),
    signature: UploadFile = File(...)
):
    try:
        if not signature.content_type or not signature.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400, 
                detail="File must be an image (JPEG, PNG)"
            )
        
        # Check if user exists
        user = users_collection.find_one({"employeeId": employeeId})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Validate file extension
        allowed_extensions = ['.jpg', '.jpeg', '.png']
        file_extension = os.path.splitext(signature.filename)[1].lower()
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail="File must be JPG, JPEG, or PNG"
            )
        
        # Read file contents
        contents = await signature.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        
        # Generate deterministic S3 key (same key for same user, overwrites existing)
        s3_key = f"users/signatures/{employeeId}{file_extension}"
        
        # Upload to S3
        from s3_service import S3Service
        s3_service = S3Service()
        s3_service.upload_image(s3_key, contents, signature.content_type)
        
        # Update user record with S3 key
        update_result = users_collection.update_one(
            {"employeeId": employeeId},
            {"$set": {"signature": s3_key}}
        )
        
        # Generate presigned URL for immediate use
        signature_url = s3_service.get_image_url(s3_key)
        
        return {
            "message": "Signature uploaded successfully", 
            "signatureUrl": signature_url,
            "signatureKey": s3_key
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("signature_upload_failed employee_id=%s", employeeId)
        raise HTTPException(status_code=500, detail=f"Error uploading signature: {str(e)}")

@user_router.delete("/signature/remove/{employeeId}")
async def remove_signature(employeeId: str):
    try:
        user = users_collection.find_one({"employeeId": employeeId})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Delete signature from S3 if exists
        if user.get("signature"):
            from s3_service import S3Service
            s3_service = S3Service()
            s3_service.delete_image(user["signature"])
        
        # Update user record
        users_collection.update_one(
            {"employeeId": employeeId},
            {"$set": {"signature": None}}
        )
        
        return {"message": "Signature removed successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing signature: {str(e)}")

@user_router.get("/signature-image")
async def get_signature_image(source: str):
    signature_key = extract_signature_key(source)
    if not signature_key:
        raise HTTPException(status_code=400, detail="Invalid signature image reference")

    try:
        from s3_service import S3Service
        s3_service = S3Service()
        response = s3_service.s3_client.get_object(
            Bucket=s3_service.bucket_name,
            Key=signature_key
        )
        image_bytes = response["Body"].read()
        content_type = response.get("ContentType") or "image/png"
        return StreamingResponse(io.BytesIO(image_bytes), media_type=content_type)
    except Exception:
        logger.exception("signature_image_load_failed key=%s", signature_key)
        raise HTTPException(status_code=404, detail="Signature image not found")

@user_router.get("/signature/{employeeId}")
async def get_signature(employeeId: str):
    user = users_collection.find_one({"employeeId": employeeId})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    signature_key = user.get("signature")
    if signature_key:
        from s3_service import S3Service
        s3_service = S3Service()
        signature_url = s3_service.get_image_url(signature_key)
        return {"signature": signature_url, "signatureKey": signature_key}
    else:
        return {"signature": None, "signatureKey": None}

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
            "phone": user.get("phone"),
            "role": user["role"],
            "status": user["status"],
            "avatar": user["avatar"],
            "isDefaultPassword": user["isDefaultPassword"],
            "createdAt": user["createdAt"],
            "signature": user.get("signature"),
            "theme": user.get("theme", "light")
        }
        return user_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user: {str(e)}")


@user_router.patch("/me/theme")
async def update_user_theme(data: dict):
    """Update user's theme. Expects JSON: { employeeId: str, theme: 'light'|'dark' }"""
    try:
        employeeId = data.get("employeeId")
        theme = data.get("theme")
        if not employeeId or theme not in ("light", "dark"):
            raise HTTPException(status_code=400, detail="Invalid request body")

        user = users_collection.find_one({"employeeId": employeeId})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        users_collection.update_one({"employeeId": employeeId}, {"$set": {"theme": theme}})
        return {"theme": theme}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating theme: {str(e)}")

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
            "phone": user.get("phone"),
            "role": user["role"],
            "status": user["status"],
            "avatar": user["avatar"],
            "isDefaultPassword": user["isDefaultPassword"],
            "createdAt": user["createdAt"],
            "signature": user.get("signature"),
            "theme": user.get("theme", "light")
        }
        return user_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user: {str(e)}")
