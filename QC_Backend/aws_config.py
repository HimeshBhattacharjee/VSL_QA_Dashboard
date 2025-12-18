import os
from dotenv import load_dotenv
load_dotenv()

class AWSConfig:
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_REGION = os.getenv('AWS_REGION')
    S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME')
    S3_BUCKET_ARN = os.getenv('S3_BUCKET_ARN')
    S3_BASE_PATH = "reports"
    S3_GEL_REPORTS = f"{S3_BASE_PATH}/gel"
    S3_PEEL_REPORTS = f"{S3_BASE_PATH}/peel"
    S3_IPQC_AUDITS = f"{S3_BASE_PATH}/ipqc"

    @classmethod
    def validate_config(cls):
        required_vars = [
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'S3_BUCKET_NAME'
        ]
        missing_vars = []
        for var in required_vars:
            if not getattr(cls, var):
                missing_vars.append(var)
        if missing_vars:
            raise ValueError(f"Missing AWS configuration variables: {', '.join(missing_vars)}")
        return True