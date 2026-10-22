"""Where uploaded photos live.

Locally they go to backend/uploads/ (served at /api/uploads/...). In production, set
the S3_* variables and they go to any S3-compatible bucket instead (Supabase Storage,
Cloudflare R2, AWS S3), because free hosts wipe the server's disk on every restart.

    S3_ENDPOINT=https://<project>.storage.supabase.co/storage/v1/s3
    S3_REGION=ap-southeast-2
    S3_BUCKET=photos
    S3_ACCESS_KEY_ID=...
    S3_SECRET_ACCESS_KEY=...
    S3_PUBLIC_URL=https://<project>.supabase.co/storage/v1/object/public/photos
"""

import logging
import os
from functools import lru_cache

from fastapi import HTTPException

from .database import UPLOAD_DIR

log = logging.getLogger("tagwise.storage")

LOCAL_PREFIX = "/api/uploads/"


def _env(name: str) -> str:
    """Setting values pasted into hosting dashboards often carry stray spaces or newlines."""
    return os.getenv(name, "").strip()


def _endpoint() -> str | None:
    url = _env("S3_ENDPOINT").rstrip("/")
    if url and "://" not in url:
        url = "https://" + url
    return url or None


def _s3_configured() -> bool:
    return bool(_env("S3_BUCKET"))


@lru_cache
def _client():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=_endpoint(),
        region_name=_env("S3_REGION") or "us-east-1",
        aws_access_key_id=_env("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=_env("S3_SECRET_ACCESS_KEY"),
        config=Config(
            signature_version="s3v4",
            # Supabase Storage (and most non-AWS providers) only accept path-style URLs:
            # <endpoint>/<bucket>/<key>, not <bucket>.<endpoint>/<key>.
            s3={"addressing_style": "path"},
            # boto3 >= 1.36 otherwise uploads as aws-chunked with a trailing CRC32 checksum,
            # which S3-compatible services like Supabase and R2 reject.
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )


def _public_base() -> str:
    return _env("S3_PUBLIC_URL").rstrip("/")


def put(name: str, data: bytes, content_type: str) -> str:
    """Store a file and return the URL the browser should load it from."""
    if _s3_configured():
        try:
            _client().put_object(
                Bucket=_env("S3_BUCKET"),
                Key=name,
                Body=data,
                ContentType=content_type,
                CacheControl="public, max-age=31536000, immutable",
            )
        except Exception as e:  # botocore ClientError, bad settings, connection errors
            code = getattr(e, "response", {}).get("Error", {}).get("Code")
            # Setting errors (e.g. "Invalid endpoint: ...") name the bad value; keep that text.
            reason = code or f"{type(e).__name__}: {str(e).strip()[:160]}"
            log.error("Photo upload to bucket %s failed: %r", _env("S3_BUCKET"), e)
            raise HTTPException(502, f"Couldn't save the photo to storage ({reason}). Check the S3_* settings on the API server.")
        return f"{_public_base()}/{name}"
    (UPLOAD_DIR / name).write_bytes(data)
    return f"{LOCAL_PREFIX}{name}"


def delete(url: str) -> None:
    """Remove a stored file given the URL `put` returned. Unknown URLs are ignored."""
    if url.startswith(LOCAL_PREFIX):
        (UPLOAD_DIR / url.removeprefix(LOCAL_PREFIX)).unlink(missing_ok=True)
    elif _s3_configured() and url.startswith(_public_base() + "/"):
        try:
            _client().delete_object(Bucket=_env("S3_BUCKET"), Key=url.removeprefix(_public_base() + "/"))
        except Exception as e:
            # The database row is removed anyway; an orphaned file is harmless.
            log.warning("Deleting %s from storage failed: %r", url, e)
