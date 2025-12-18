import boto3
import json
from typing import Dict, Any
from botocore.exceptions import ClientError
from aws_config import AWSConfig

class S3Service:
    def __init__(self):
        AWSConfig.validate_config()
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=AWSConfig.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWSConfig.AWS_SECRET_ACCESS_KEY,
            region_name=AWSConfig.AWS_REGION
        )
        self.bucket_name = AWSConfig.S3_BUCKET_NAME

    def uploadOrOverwriteJson(self, s3Key: str, data: Dict[str, Any]) -> bool:
        """Upload or overwrite JSON data in S3 using exact s3Key"""
        try:
            json_data = json.dumps(data, ensure_ascii=False, indent=2)
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3Key,
                Body=json_data.encode('utf-8'),
                ContentType='application/json'
            )
            return True
        except ClientError as e:
            print(f"Error uploading/overwriting to S3: {str(e)}")
            raise

    def getJsonFromS3(self, s3Key: str) -> Dict[str, Any]:
        """Get JSON data from S3 using exact s3Key"""
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=s3Key
            )
            json_data = response['Body'].read().decode('utf-8')
            return json.loads(json_data)
        except ClientError as e:
            print(f"Error downloading from S3: {str(e)}")
            raise

    def deleteJsonFromS3(self, s3Key: str) -> bool:
        """Delete JSON file from S3 using exact s3Key"""
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3Key
            )
            return True
        except ClientError as e:
            print(f"Error deleting from S3: {str(e)}")
            raise

    def upload_json(self, folder: str, filename: str, data: Dict[str, Any]) -> str:
        try:
            s3_key = f"{AWSConfig.S3_BASE_PATH}/{folder}/{filename}"
            json_data = json.dumps(data, ensure_ascii=False, indent=2)
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=json_data.encode('utf-8'),
                ContentType='application/json'
            )
            return s3_key
        except ClientError as e:
            print(f"Error uploading to S3: {str(e)}")
            raise

    def download_json(self, s3_key: str) -> Dict[str, Any]:
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            json_data = response['Body'].read().decode('utf-8')
            return json.loads(json_data)
        except ClientError as e:
            print(f"Error downloading from S3: {str(e)}")
            raise

    def delete_json(self, s3_key: str) -> bool:
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            return True
        except ClientError as e:
            print(f"Error deleting from S3: {str(e)}")
            raise

    def update_json(self, s3_key: str, data: Dict[str, Any]) -> str:
        return self.upload_json(
            folder=self._extract_folder_from_key(s3_key),
            filename=self._extract_filename_from_key(s3_key),
            data=data
        )

    def _extract_folder_from_key(self, s3_key: str) -> str:
        parts = s3_key.split('/')
        if len(parts) >= 3:
            return parts[1]  # reports/<folder>/filename.json
        return ""

    def _extract_filename_from_key(self, s3_key: str) -> str:
        return s3_key.split('/')[-1]

    def generate_s3_key(self, report_type: str, report_name: str, timestamp: str) -> str:
        import re
        from datetime import datetime
        safe_name = re.sub(r'[^\w\-_.]', '_', report_name)
        timestamp_obj = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        date_str = timestamp_obj.strftime('%Y-%m-%d_%H-%M-%S')
        filename = f"{safe_name}_{date_str}.json"

        if report_type == 'gel':
            return f"{AWSConfig.S3_GEL_REPORTS}/{filename}"
        elif report_type == 'peel':
            return f"{AWSConfig.S3_PEEL_REPORTS}/{filename}"
        elif report_type == 'ipqc-audit':
            return f"{AWSConfig.S3_IPQC_AUDITS}/{filename}"
        else:
            return f"{AWSConfig.S3_BASE_PATH}/{report_type}/{filename}"

    @staticmethod
    def generate_fixed_s3_key(report_type: str, mongo_id: str) -> str:
        """Generate a fixed S3 key using MongoDB _id - never changes"""
        if report_type == 'gel':
            return f"{AWSConfig.S3_GEL_REPORTS}/{mongo_id}.json"
        elif report_type == 'peel':
            return f"{AWSConfig.S3_PEEL_REPORTS}/{mongo_id}.json"
        elif report_type == 'ipqc-audit':
            return f"{AWSConfig.S3_IPQC_AUDITS}/{mongo_id}.json"
        else:
            return f"{AWSConfig.S3_BASE_PATH}/{report_type}/{mongo_id}.json"