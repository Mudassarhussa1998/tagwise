"""Test setup: a real Postgres test database and a fake Clerk signing key.

Run with:  createdb tagwise_test && pytest
"""

import os
import tempfile
import time

os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "postgresql+psycopg://localhost:5432/tagwise_test")
os.environ["CLERK_ISSUER"] = "https://test.clerk.example"
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="tagwise-test-uploads-")
os.environ["CLERK_AUTHORIZED_PARTIES"] = "http://localhost:3000"

import jwt  # noqa: E402
import pytest  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import rsa  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import security  # noqa: E402
from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.routers import auth as auth_router  # noqa: E402

PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)

PROFILES = {
    "user_admin": security.ClerkProfile(name="Ayesha Admin", email="ayesha@acme.example.com"),
    "user_member": security.ClerkProfile(name="Omar Operator", email="omar@acme.example.com"),
    "user_stranger": security.ClerkProfile(name="Sam Stranger", email="sam@other.example.com"),
}


class FakeJWKS:
    def get_signing_key_from_jwt(self, token):
        return type("Key", (), {"key": PRIVATE_KEY.public_key()})()


def make_token(sub: str, *, azp="http://localhost:3000", iss="https://test.clerk.example", ttl=60, key=PRIVATE_KEY) -> str:
    now = int(time.time())
    return jwt.encode({"sub": sub, "azp": azp, "iss": iss, "iat": now, "nbf": now, "exp": now + ttl}, key, algorithm="RS256")


def auth(sub: str) -> dict:
    return {"Authorization": f"Bearer {make_token(sub)}"}


@pytest.fixture()
def client(monkeypatch):
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    monkeypatch.setattr(security, "jwks_client", lambda: FakeJWKS())
    monkeypatch.setattr(auth_router, "fetch_clerk_profile", lambda clerk_id: PROFILES[clerk_id])
    with TestClient(app) as c:
        yield c
