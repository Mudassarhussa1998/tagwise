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
