"""Authentication with Clerk.

The frontend sends Clerk's short-lived session token as `Authorization: Bearer <jwt>`.
We verify it against the instance's JWKS (RS256), then map the Clerk user id (`sub`)
to a local User row that carries the organization and role.
"""

import base64
import logging
import os
from dataclasses import dataclass
from functools import lru_cache

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

# .strip(): keys pasted into hosting dashboards often carry a stray space or newline.
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "").strip()
CLERK_PUBLISHABLE_KEY = os.getenv("CLERK_PUBLISHABLE_KEY", "").strip()
# Origins allowed to have minted the token (the `azp` claim). Empty disables the check.
AUTHORIZED_PARTIES = [p.strip().rstrip("/") for p in os.getenv("CLERK_AUTHORIZED_PARTIES", "http://localhost:3000").split(",") if p.strip()]

# Site owners: can see every company and user at /admin. Comma-separated emails.
PLATFORM_ADMIN_EMAILS = {e.strip().lower() for e in os.getenv("PLATFORM_ADMIN_EMAILS", "").split(",") if e.strip()}

bearer = HTTPBearer(auto_error=False)
log = logging.getLogger("tagwise.auth")


def clerk_issuer() -> str:
    """The Clerk Frontend API URL, e.g. https://xxx.clerk.accounts.dev.

    Set CLERK_ISSUER explicitly, or let it be derived from the publishable key,
    which is `pk_<env>_` + base64("<frontend-api-host>$").
    """
    if issuer := os.getenv("CLERK_ISSUER"):
        return issuer.rstrip("/")
    try:
        encoded = CLERK_PUBLISHABLE_KEY.split("_", 2)[2]
        host = base64.b64decode(encoded + "=" * (-len(encoded) % 4)).decode().rstrip("$")
    except (IndexError, ValueError):
        host = ""
    if "." not in host:
        raise RuntimeError("Set CLERK_PUBLISHABLE_KEY (or CLERK_ISSUER) in backend/.env")
    return f"https://{host}"


@lru_cache
def jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{clerk_issuer()}/.well-known/jwks.json", cache_keys=True, lifespan=3600)


def verify_session_token(token: str) -> dict:
    signing_key = jwks_client().get_signing_key_from_jwt(token).key
    claims = jwt.decode(
        token,
        signing_key,
        algorithms=["RS256"],
        issuer=clerk_issuer(),
        options={"require": ["exp", "iat", "iss", "sub"]},
        leeway=5,
    )
    azp = claims.get("azp")
    if azp and AUTHORIZED_PARTIES and azp not in AUTHORIZED_PARTIES:
        raise jwt.InvalidTokenError("Token minted for an unexpected origin")
    return claims


def get_clerk_user_id(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        return verify_session_token(creds.credentials)["sub"]
    except RuntimeError as e:  # Clerk keys missing or still placeholders
        raise HTTPException(500, str(e))
    except (jwt.PyJWTError, jwt.PyJWKClientError, KeyError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")


def get_current_user(clerk_id: str = Depends(get_clerk_user_id), db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.clerk_id == clerk_id))
    if user is None:
        # Signed in with Clerk but not yet part of an organization here.
        raise HTTPException(status.HTTP_403_FORBIDDEN, "onboarding_required")
    return user


def is_platform_admin(user: User) -> bool:
    return bool(user.email) and user.email.lower() in PLATFORM_ADMIN_EMAILS


def require_platform_admin(user: User = Depends(get_current_user)) -> User:
    if not is_platform_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Platform admins only")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins only")
    return user


@dataclass
class ClerkProfile:
    name: str
    email: str  # primary email, only if Clerk has verified it; "" otherwise


def fetch_clerk_profile(clerk_id: str) -> ClerkProfile:
    """Read name and verified email from Clerk's Backend API (needs CLERK_SECRET_KEY)."""
    if not CLERK_SECRET_KEY:
        raise HTTPException(500, "CLERK_SECRET_KEY is not configured on the API server")
    try:
        res = httpx.get(
            f"https://api.clerk.com/v1/users/{clerk_id}",
            headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"},
            timeout=10,
        )
    except httpx.HTTPError as e:
        log.warning("Clerk user lookup failed: %r", e)
        raise HTTPException(502, "Couldn't reach Clerk to load your profile. Try again.")
    if res.status_code in (401, 403):
        log.error("Clerk rejected CLERK_SECRET_KEY (HTTP %s)", res.status_code)
        raise HTTPException(500, "The API server's CLERK_SECRET_KEY is invalid. Check it in the hosting dashboard.")
    if res.status_code == 404:
        log.error("Clerk user %s not found: CLERK_SECRET_KEY is for a different Clerk app than CLERK_PUBLISHABLE_KEY", clerk_id)
        raise HTTPException(500, "The API server's CLERK_SECRET_KEY belongs to a different Clerk application than its publishable key.")
    if res.is_error:
        log.warning("Clerk user lookup returned HTTP %s: %s", res.status_code, res.text[:200])
        raise HTTPException(502, f"Clerk returned an error ({res.status_code}) while loading your profile. Try again.")
    return profile_from_clerk_user(res.json())


def profile_from_clerk_user(data: dict) -> ClerkProfile:
    email = next(
        (
            e["email_address"].lower()
            for e in data.get("email_addresses", [])
            if e["id"] == data.get("primary_email_address_id") and (e.get("verification") or {}).get("status") == "verified"
        ),
        "",
    )
    name = " ".join(p for p in (data.get("first_name"), data.get("last_name")) if p) or data.get("username") or email.split("@")[0]
    return ClerkProfile(name=(name or "New user")[:120], email=email)


def list_clerk_users(limit: int = 100) -> tuple[list[dict], int | None]:
    """Newest Clerk accounts (raw user objects) and the total count, for the platform admin page."""
    if not CLERK_SECRET_KEY:
        raise HTTPException(500, "CLERK_SECRET_KEY is not configured on the API server")
    headers = {"Authorization": f"Bearer {CLERK_SECRET_KEY}"}
    try:
        users = httpx.get("https://api.clerk.com/v1/users", params={"limit": limit, "order_by": "-created_at"}, headers=headers, timeout=15)
        users.raise_for_status()
        count = httpx.get("https://api.clerk.com/v1/users/count", headers=headers, timeout=15)
        total = count.json().get("total_count") if count.is_success else None
    except httpx.HTTPError as e:
        log.warning("Listing Clerk users failed: %r", e)
        raise HTTPException(502, "Couldn't load the sign-up list from Clerk. Try again.")
    return users.json(), total
