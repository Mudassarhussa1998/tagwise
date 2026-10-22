"""Production-only paths: cloud photo storage and hosted Postgres URLs."""

from app import database, storage

from .conftest import auth
from .test_api import PNG, onboard


class FakeS3:
    def __init__(self):
        self.objects = {}

    def put_object(self, Bucket, Key, Body, ContentType, CacheControl):
        self.objects[(Bucket, Key)] = (Body, ContentType)

    def delete_object(self, Bucket, Key):
        self.objects.pop((Bucket, Key), None)


def test_photos_go_to_s3_bucket_when_configured(client, monkeypatch):
    fake = FakeS3()
    monkeypatch.setenv("S3_BUCKET", "photos")
    monkeypatch.setenv("S3_PUBLIC_URL", "https://proj.supabase.co/storage/v1/object/public/photos/")
    monkeypatch.setattr(storage, "_client", lambda: fake)

    onboard(client)
    h = auth("user_admin")
    asset = client.post("/api/assets", json={"code": "ex-04", "name": "Excavator"}, headers=h).json()
    detail = client.post(f"/api/assets/{asset['id']}/photos", files={"photo": ("a.png", PNG, "image/png")}, headers=h).json()

    url = detail["photos"][0]["url"]
    assert url.startswith("https://proj.supabase.co/storage/v1/object/public/photos/") and url.endswith(".png")
    key = url.rsplit("/", 1)[-1]
    assert fake.objects[("photos", key)] == (PNG, "image/png")

    client.delete(f"/api/assets/{asset['id']}/photos/{detail['photos'][0]['id']}", headers=h)
    assert fake.objects == {}


def test_hosted_database_urls_use_psycopg_driver(monkeypatch):
    for given in ("postgres://u:p@db.example.com:5432/app", "postgresql://u:p@db.example.com:5432/app"):
        monkeypatch.setenv("DATABASE_URL", given)
        assert database.database_url() == "postgresql+psycopg://u:p@db.example.com:5432/app"
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@h/app")
    assert database.database_url() == "postgresql+psycopg://u:p@h/app"


def test_s3_client_uses_path_style_for_supabase(monkeypatch):
    monkeypatch.setenv("S3_ENDPOINT", "https://proj.storage.supabase.co/storage/v1/s3")
    monkeypatch.setenv("S3_REGION", "ap-southeast-2")
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "id")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "secret")
    storage._client.cache_clear()
    try:
        client = storage._client()
        url = client.generate_presigned_url("put_object", Params={"Bucket": "photos", "Key": "a.png"}, ExpiresIn=60)
        assert url.startswith("https://proj.storage.supabase.co/storage/v1/s3/photos/a.png?")
    finally:
        storage._client.cache_clear()


def test_clerk_profile_errors_name_the_misconfiguration(monkeypatch):
    import httpx
    import pytest
    from fastapi import HTTPException

    from app import security

    monkeypatch.setattr(security, "CLERK_SECRET_KEY", "sk_test_x")
    for status, expected in ((401, "CLERK_SECRET_KEY is invalid"), (404, "different Clerk application"), (500, "Clerk returned an error (500)")):
        monkeypatch.setattr(security.httpx, "get", lambda *a, status=status, **k: httpx.Response(status, request=httpx.Request("GET", "https://api.clerk.com")))
        with pytest.raises(HTTPException) as err:
            security.fetch_clerk_profile("user_1")
        assert expected in err.value.detail
