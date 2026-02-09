from dotenv import load_dotenv
import os
load_dotenv()

SERVER_URL = '0.0.0.0'
PORT = os.getenv('PORT')
MONGODB_URI = os.getenv('MONGODB_URI')

MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME')

_required_db_vars = {
    'MONGODB_DB_NAME': MONGODB_DB_NAME,
}
_missing_db = [k for k, v in _required_db_vars.items() if not v]
if _missing_db:
	raise EnvironmentError(f"Missing required MongoDB DB name env var(s): {', '.join(_missing_db)}")