from dotenv import load_dotenv
import os
load_dotenv()

SERVER_URL = '0.0.0.0'
PORT = '8000'
MONGODB_URI = os.getenv('MONGODB_URI')