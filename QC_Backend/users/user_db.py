import os
from pymongo import MongoClient
from datetime import datetime

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
client = MongoClient(MONGODB_URL)
db = client["vsl_quality_portal"]
users_collection = db["users"]

def generate_password(name: str, employee_id: str, phone: str) -> str:
    first_two_letters = ''.join([word[0] for word in name.split()])[:2]
    last_four_employee = employee_id[-4:]
    last_four_phone = phone[-4:]
    return f"{first_two_letters}{last_four_employee}{last_four_phone}"

def create_initial_admin():
    admin_exists = users_collection.find_one({"role": "Admin"})
    if not admin_exists:
        initial_admin = {
            "name": "System Administrator",
            "employeeId": "ADMIN001",
            "phone": "0000000000",
            "role": "Admin",
            "password": "Admin@123",
            "status": "Active",
            "avatar": "SA",
            "isDefaultPassword": True,
            "createdAt": datetime.now().isoformat()
        }
        users_collection.insert_one(initial_admin)
        print("Initial admin user created")

create_initial_admin()