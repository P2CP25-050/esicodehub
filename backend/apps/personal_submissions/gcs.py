from google.cloud import storage
from django.conf import settings


def get_gcs_client():
    return storage.Client.from_service_account_json(
        settings.GS_CREDENTIALS
    )


def upload_file(file_obj, gcs_path: str) -> str:
    """Upload a file to GCS and return the full GCS path."""
    client = get_gcs_client()
    bucket = client.bucket(settings.GS_BUCKET_NAME)
    blob = bucket.blob(gcs_path)
    blob.upload_from_file(file_obj, rewind=True)
    return gcs_path


def delete_file(gcs_path: str) -> None:
    """Delete a file from GCS."""
    client = get_gcs_client()
    bucket = client.bucket(settings.GS_BUCKET_NAME)
    blob = bucket.blob(gcs_path)
    if blob.exists():
        blob.delete()


def delete_directory(prefix: str) -> None:
    """Delete all files under a GCS prefix (simulates directory delete)."""
    client = get_gcs_client()
    bucket = client.bucket(settings.GS_BUCKET_NAME)
    blobs = bucket.list_blobs(prefix=prefix)
    for blob in blobs:
        blob.delete()


def get_signed_url(gcs_path: str, expiration: int = 3600) -> str:
    """Generate a signed URL for temporary file access."""
    from datetime import timedelta
    client = get_gcs_client()
    bucket = client.bucket(settings.GS_BUCKET_NAME)
    blob = bucket.blob(gcs_path)
    return blob.generate_signed_url(
        expiration=timedelta(seconds=expiration),
        method='GET'
    )


def get_file_content(gcs_path: str) -> str:
    """Download and return file content as a string."""
    client = get_gcs_client()
    bucket = client.bucket(settings.GS_BUCKET_NAME)
    blob = bucket.blob(gcs_path)
    return blob.download_as_text()
