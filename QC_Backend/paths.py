import os
import tempfile
from pathlib import Path
from s3_service import get_s3_client
from dotenv import load_dotenv

load_dotenv()

def get_qc_data_key(*subpaths: str) -> str:
    """Return S3 key for QC_Data path"""
    prefix = os.getenv("QC_S3_PREFIX", "QC_Data")
    return f"{prefix}/{'/'.join(subpaths)}"

def get_template_key(filename: str) -> str:
    """Return S3 key for template file"""
    return get_qc_data_key("Templates", filename)

def get_reference_file_key(filename: str) -> str:
    """Return S3 key for reference file"""
    return get_qc_data_key("Reference_Files", filename)

def download_from_s3(s3_key: str, local_path: Path = None) -> Path:
    """Download file from S3 to local temp file or specified path"""
    s3_client = get_s3_client()
    bucket = os.getenv("S3_BUCKET_NAME")
    if not bucket:
        raise ValueError("S3_BUCKET_NAME environment variable not set")

    if local_path is None:
        local_path = Path(tempfile.NamedTemporaryFile(delete=False, suffix=Path(s3_key).suffix).name)

    s3_client.download_file(bucket, s3_key, str(local_path))
    return local_path

def download_folder_from_s3(s3_prefix: str, local_dir: Path = None) -> Path:
    """Download entire folder from S3 to local temp directory"""
    s3_client = get_s3_client()
    bucket = os.getenv("S3_BUCKET_NAME")
    if not bucket:
        raise ValueError("S3_BUCKET_NAME environment variable not set")

    if local_dir is None:
        local_dir = Path(tempfile.mkdtemp())

    # List objects with prefix
    paginator = s3_client.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=bucket, Prefix=s3_prefix):
        for obj in page.get('Contents', []):
            key = obj['Key']
            # Remove prefix to get relative path
            relative_path = key[len(s3_prefix):].lstrip('/')
            local_file = local_dir / relative_path
            local_file.parent.mkdir(parents=True, exist_ok=True)
            s3_client.download_file(bucket, key, str(local_file))

    return local_dir

# Legacy functions for backward compatibility (deprecated)
def get_project_root() -> Path:
    current_file = Path(__file__).resolve()
    return current_file.parent.parent

def get_qc_data_path(*subpaths: str) -> Path:
    return get_project_root() / "QC_Data" / Path(*subpaths)

def get_template_path(filename: str) -> Path:
    return get_qc_data_path("Templates", filename)

def get_reference_file_path(filename: str) -> Path:
    return get_qc_data_path("Reference_Files", filename)

def ensure_qc_data_structure():
    directories = [
        get_qc_data_path("Templates"),
        get_qc_data_path("Reference_Files")
    ]
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)