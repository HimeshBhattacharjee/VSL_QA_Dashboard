import boto3
from botocore.exceptions import NoCredentialsError, ClientError
import os
from dotenv import load_dotenv
load_dotenv()

AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.getenv('AWS_REGION')
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME')
S3_FILE_KEY = "QC_Data/Templates/Blank Audit Line-II.xlsx"
LOCAL_FILE_PATH = r"C:\Users\himesh.b\Downloads\Blank Audit Line-II.xlsx"

def get_s3_client():
    return boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY
    )   

def delete_existing_file(s3_client):
    try:
        s3_client.delete_object(
            Bucket=S3_BUCKET_NAME,
            Key=S3_FILE_KEY
        )
        print(f"Deleted existing file: {S3_FILE_KEY}")

    except ClientError as e:
        print(f"Error deleting file: {e}")


def upload_new_file(s3_client):
    try:
        if not os.path.exists(LOCAL_FILE_PATH):
            print("Local file does not exist.")
            return

        s3_client.upload_file(
            LOCAL_FILE_PATH,
            S3_BUCKET_NAME,
            S3_FILE_KEY
        )
        print(f"Uploaded new file successfully: {S3_FILE_KEY}")

    except FileNotFoundError:
        print("File not found.")

    except NoCredentialsError:
        print("AWS credentials not found.")

    except ClientError as e:
        print(f"Upload failed: {e}")


if __name__ == "__main__":
    s3_client = get_s3_client()
    delete_existing_file(s3_client)
    upload_new_file(s3_client)