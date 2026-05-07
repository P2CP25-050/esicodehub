import os
import json

from google.cloud import storage
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def _get_credentials_path() -> str:
    credentials_path = (
        getattr(settings, 'GCS_CREDENTIALS_PATH', None)
        or getattr(settings, 'GS_CREDENTIALS', None)
        or os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    )

    if not credentials_path:
        raise ImproperlyConfigured(
            'GCS credentials are not configured. Set GCS_CREDENTIALS_PATH '
            '(recommended) or GOOGLE_APPLICATION_CREDENTIALS.'
        )

    # Common misconfiguration in Docker on Windows is passing a host path
    # instead of a container path.
    if '\\' in credentials_path and not credentials_path.startswith('/'):
        raise ImproperlyConfigured(
            'GCS_CREDENTIALS_PATH appears to be a host path. In Docker, use '
            'the in-container path (for example /app/gcs-credentials.json) '
            'and ensure the file is mounted.'
        )

    return credentials_path


def _use_adc() -> bool:
    # Cloud Run/GAE provide Application Default Credentials without a JSON key file.
    if os.getenv('GOOGLE_APPLICATION_CREDENTIALS'):
        return False
    if getattr(settings, 'GCS_CREDENTIALS_PATH', None) or getattr(settings, 'GS_CREDENTIALS', None):
        return False
    return bool(
        os.getenv('GOOGLE_CLOUD_PROJECT')
        or os.getenv('K_SERVICE')
        or os.getenv('K_REVISION')
        or os.getenv('GAE_ENV')
    )


def validate_gcs_configuration() -> list[str]:
    issues = []

    if not settings.GS_BUCKET_NAME:
        issues.append('GCS_BUCKET_NAME is not set.')

    credentials_path = None
    if not _use_adc():
        try:
            credentials_path = _get_credentials_path()
        except ImproperlyConfigured as exc:
            issues.append(str(exc))

        if credentials_path:
            if not os.path.exists(credentials_path):
                issues.append(
                    f'GCS credentials file not found at: {credentials_path}. '
                    'Ensure docker-compose volume mapping is correct.'
                )
            else:
                try:
                    with open(credentials_path, 'r', encoding='utf-8') as handle:
                        json.load(handle)
                except Exception as exc:
                    issues.append(f'GCS credentials file is not valid JSON: {exc}')

    return issues


def get_gcs_client():
    issues = validate_gcs_configuration()
    if issues:
        raise ImproperlyConfigured(' '.join(issues))

    if _use_adc():
        try:
            return storage.Client()
        except Exception as exc:
            raise ImproperlyConfigured(
                f'Failed to initialize Google Cloud Storage client: {exc}'
            ) from exc

    credentials_path = _get_credentials_path()
    try:
        return storage.Client.from_service_account_json(credentials_path)
    except Exception as exc:
        raise ImproperlyConfigured(
            f'Failed to initialize Google Cloud Storage client: {exc}'
        ) from exc


def upload_file(
    file_obj,
    gcs_path: str,
    content_type: str | None = None,
    content_disposition: str | None = None,
) -> str:
    """Upload a file to GCS and return the full GCS path."""
    client = get_gcs_client()
    bucket = client.bucket(settings.GS_BUCKET_NAME)
    blob = bucket.blob(gcs_path)

    if content_type:
        blob.content_type = content_type
    if content_disposition:
        blob.content_disposition = content_disposition

    blob.upload_from_file(file_obj, rewind=True, content_type=content_type)

    if content_disposition:
        blob.patch()

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


def get_signed_url(
    gcs_path: str,
    expiration: int = 3600,
    response_type: str | None = None,
    response_disposition: str | None = None,
) -> str:
    """Generate a signed URL for temporary file access."""
    from datetime import timedelta
    client = get_gcs_client()
    bucket = client.bucket(settings.GS_BUCKET_NAME)
    blob = bucket.blob(gcs_path)
    return blob.generate_signed_url(
        expiration=timedelta(seconds=expiration),
        method='GET',
        response_type=response_type,
        response_disposition=response_disposition,
    )


def get_file_content(gcs_path: str) -> str:
    """Download and return file content as a string."""
    client = get_gcs_client()
    bucket = client.bucket(settings.GS_BUCKET_NAME)
    blob = bucket.blob(gcs_path)
    return blob.download_as_text()


def upload_file_content(gcs_path: str, content: str) -> None:
    """Upload a plain text string to GCS at the given path."""
    client = get_gcs_client()
    bucket = client.bucket(settings.GS_BUCKET_NAME)
    blob = bucket.blob(gcs_path)
    blob.upload_from_string(content, content_type='text/plain; charset=utf-8')
