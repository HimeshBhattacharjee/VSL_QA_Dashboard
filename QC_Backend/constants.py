from dotenv import load_dotenv
import os
load_dotenv()

SERVER_URL = '0.0.0.0'
PORT = '8000'
MONGODB_URI = os.getenv('MONGODB_URI')
 
# MongoDB database names (must be provided via environment variables)
MONGODB_DB_NAME_QUALITY_ANALYSIS = os.getenv('MONGODB_DB_NAME_QUALITY_ANALYSIS')
MONGODB_DB_NAME_USERS = os.getenv('MONGODB_DB_NAME_USERS')
MONGODB_DB_NAME_REPORTS = os.getenv('MONGODB_DB_NAME_REPORTS')
MONGODB_DB_NAME_B_GRADE = os.getenv('MONGODB_DB_NAME_B_GRADE')
MONGODB_DB_NAME_PEEL_TEST = os.getenv('MONGODB_DB_NAME_PEEL_TEST')

# Validate that required DB name env vars are present at startup
_required_db_vars = {
    'MONGODB_DB_NAME_QUALITY_ANALYSIS': MONGODB_DB_NAME_QUALITY_ANALYSIS,
    'MONGODB_DB_NAME_USERS': MONGODB_DB_NAME_USERS,
    'MONGODB_DB_NAME_REPORTS': MONGODB_DB_NAME_REPORTS,
    'MONGODB_DB_NAME_B_GRADE': MONGODB_DB_NAME_B_GRADE,
    'MONGODB_DB_NAME_PEEL_TEST': MONGODB_DB_NAME_PEEL_TEST,
}
_missing_db = [k for k, v in _required_db_vars.items() if not v]
if _missing_db:
	raise EnvironmentError(f"Missing required MongoDB DB name env var(s): {', '.join(_missing_db)}")