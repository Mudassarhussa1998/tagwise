"""Where uploaded photos live.

Locally they go to backend/uploads/ (served at /api/uploads/...). In production, set
the S3_* variables and they go to any S3-compatible bucket instead (Supabase Storage,
Cloudflare R2, AWS S3), because free hosts wipe the server's disk on every restart.

    S3_ENDPOINT=https://<project>.supabase.co/storage/v1/s3
    S3_REGION=ap-southeast-1
    S3_BUCKET=photos
    S3_ACCESS_KEY_ID=...
    S3_SECRET_ACCESS_KEY=...
    S3_PUBLIC_URL=https://<project>.supabase.co/storage/v1/object/public/photos
"""

import os
from functools import lru_cache

from .database import UPLOAD_DIR

LOCAL_PREFIX = "/api/uploads/"


def _s3_configured() -> bool:
    return bool(os.getenv("S3_BUCKET"))


@lru_cache
def _client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT") or None,
        region_name=os.getenv("S3_REGION") or "us-east-1",
        aws_access_key_id=os.getenv("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY"),
    )


def _public_base() -> str:
    return os.environ["S3_PUBLIC_URL"].rstrip("/")


def put(name: str, data: bytes, content_type: str) -> str:
    """Store a file and return the URL the browser should load it from."""
    if _s3_configured():
        _client().put_object(
            Bucket=os.environ["S3_BUCKET"],
            Key=name,
            Body=data,
            ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )
        return f"{_public_base()}/{name}"
    (UPLOAD_DIR / name).write_bytes(data)
    return f"{LOCAL_PREFIX}{name}"


def delete(url: str) -> None:
    """Remove a stored file given the URL `put` returned. Unknown URLs are ignored."""
    if url.startswith(LOCAL_PREFIX):
        (UPLOAD_DIR / url.removeprefix(LOCAL_PREFIX)).unlink(missing_ok=True)
    elif _s3_configured() and url.startswith(_public_base() + "/"):
        _client().delete_object(Bucket=os.environ["S3_BUCKET"], Key=url.removeprefix(_public_base() + "/"))
