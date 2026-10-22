"""Platform admin (site owner) endpoints."""

import json

from app import security
from app.routers import platform

from .conftest import auth
from .test_api import onboard


def setup_two_companies(client):
    onboard(client)  # user_admin → Acme Plant
    onboard(client, sub="user_stranger", org="Other Co")
    h = auth("user_admin")
    asset = client.post("/api/assets", json={"code": "ex-04", "name": "Excavator", "checklist": ["Tracks OK"]}, headers=h).json()
    item = client.get(f"/api/public/{asset['qr_token']}").json()["checklist"][0]["id"]
    payload = {"inspector_name": "Bilal", "answers": [{"item_id": item, "ok": False}]}
    client.post(f"/api/public/{asset['qr_token']}/inspections", data={"payload": json.dumps(payload)})
    client.post("/api/invites", json={"email": "new@acme.example.com"}, headers=h)


def test_only_platform_admins_get_in(client, monkeypatch):
    monkeypatch.setattr(security, "PLATFORM_ADMIN_EMAILS", {"ayesha@acme.example.com"})
    setup_two_companies(client)
    # A company admin who isn't a platform admin is refused everywhere.
    for path in ("/overview", "/companies", "/users", "/signups"):
        assert client.get(f"/api/platform{path}", headers=auth("user_stranger")).status_code == 403
    assert client.get("/api/platform/overview").status_code == 401
    # The flag that shows the Admin link.
    assert client.get("/api/auth/session", headers=auth("user_admin")).json()["user"]["is_platform_admin"] is True
    assert client.get("/api/auth/session", headers=auth("user_stranger")).json()["user"]["is_platform_admin"] is False


def test_platform_admin_sees_every_company_and_user(client, monkeypatch):
    monkeypatch.setattr(security, "PLATFORM_ADMIN_EMAILS", {"ayesha@acme.example.com"})
    setup_two_companies(client)
    h = auth("user_admin")

    totals = client.get("/api/platform/overview", headers=h).json()["totals"]
    assert totals == {
        **totals,
        "companies": 2, "users": 2, "assets": 1, "inspections": 1, "open_issues": 1,
        "pending_invites": 1, "companies_7d": 2, "users_7d": 2, "inspections_7d": 1,
    }

    companies = {c["name"]: c for c in client.get("/api/platform/companies", headers=h).json()}
    assert companies["Acme Plant"] | {"last_activity": None, "created_at": None, "id": 0} == {
        "id": 0, "name": "Acme Plant", "created_at": None, "users": 1, "admins": 1,
        "assets": 1, "inspections": 1, "open_issues": 1, "last_activity": None,
    }
    assert companies["Acme Plant"]["last_activity"] is not None
    assert companies["Other Co"]["assets"] == 0 and companies["Other Co"]["last_activity"] is None

    users = client.get("/api/platform/users", headers=h).json()
    assert sorted((u["email"], u["company_name"], u["role"]) for u in users) == [
        ("ayesha@acme.example.com", "Acme Plant", "admin"),
        ("sam@other.example.com", "Other Co", "admin"),
    ]


def test_signups_list_clerk_accounts_without_a_company(client, monkeypatch):
    monkeypatch.setattr(security, "PLATFORM_ADMIN_EMAILS", {"ayesha@acme.example.com"})
    onboard(client)
    clerk_users = [
        {"id": "user_admin", "first_name": "Ayesha", "primary_email_address_id": "e1",
         "email_addresses": [{"id": "e1", "email_address": "ayesha@acme.example.com", "verification": {"status": "verified"}}],
         "created_at": 1_790_000_000_000, "last_sign_in_at": 1_790_000_100_000},
        {"id": "user_new", "first_name": "Zara", "last_name": "Khan", "primary_email_address_id": "e2",
         "email_addresses": [{"id": "e2", "email_address": "Zara@New.example.com", "verification": {"status": "verified"}}],
         "created_at": 1_790_000_200_000, "last_sign_in_at": None},
    ]
    monkeypatch.setattr(platform, "list_clerk_users", lambda: (clerk_users, 2))
    data = client.get("/api/platform/signups", headers=auth("user_admin")).json()
    assert data["clerk_total"] == 2
    assert [(s["clerk_id"], s["name"], s["email"]) for s in data["without_company"]] == [("user_new", "Zara Khan", "zara@new.example.com")]
    assert data["without_company"][0]["created_at"].startswith("2026-")
