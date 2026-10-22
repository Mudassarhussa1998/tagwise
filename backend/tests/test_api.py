import json

from cryptography.hazmat.primitives.asymmetric import rsa

from .conftest import auth, make_token


def onboard(client, sub="user_admin", org="Acme Plant"):
    res = client.post("/api/auth/onboard", json={"organization": org}, headers=auth(sub))
    assert res.status_code == 201, res.text
    return res.json()


def test_rejects_missing_and_bad_tokens(client):
    assert client.get("/api/auth/session").status_code == 401
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    bad = {
        "expired": make_token("user_admin", ttl=-60),
        "wrong issuer": make_token("user_admin", iss="https://evil.example"),
        "wrong origin": make_token("user_admin", azp="https://evil.example"),
        "wrong key": make_token("user_admin", key=other_key),
    }
    for label, token in bad.items():
        res = client.get("/api/auth/session", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 401, label


def test_new_user_must_onboard(client):
    res = client.get("/api/auth/session", headers=auth("user_admin"))
    assert res.json() == {"user": None, "email": "ayesha@acme.example.com"}
    assert client.get("/api/assets", headers=auth("user_admin")).status_code == 403

    me = onboard(client)
    assert me["role"] == "admin" and me["organization_name"] == "Acme Plant"
    assert client.get("/api/auth/session", headers=auth("user_admin")).json()["user"]["email"] == "ayesha@acme.example.com"
    assert client.post("/api/auth/onboard", json={"organization": "Again"}, headers=auth("user_admin")).status_code == 409


def test_invite_is_claimed_on_first_sign_in(client):
    onboard(client)
    res = client.post("/api/invites", json={"email": "Omar@Acme.example.com", "role": "member"}, headers=auth("user_admin"))
    assert res.status_code == 201
    assert client.post("/api/invites", json={"email": "omar@acme.example.com"}, headers=auth("user_admin")).status_code == 409

    session = client.get("/api/auth/session", headers=auth("user_member")).json()
    assert session["user"]["role"] == "member" and session["user"]["organization_name"] == "Acme Plant"
    assert client.get("/api/invites", headers=auth("user_admin")).json() == []
    assert len(client.get("/api/users", headers=auth("user_admin")).json()) == 2
    # members can't invite
    assert client.post("/api/invites", json={"email": "x@acme.example.com"}, headers=auth("user_member")).status_code == 403


def test_organizations_are_isolated(client):
    onboard(client)
    onboard(client, sub="user_stranger", org="Other Co")
    asset = client.post("/api/assets", json={"code": "fl-08", "name": "Forklift"}, headers=auth("user_admin")).json()
    assert client.get(f"/api/assets/{asset['id']}", headers=auth("user_stranger")).status_code == 404
    assert client.get("/api/assets", headers=auth("user_stranger")).json() == []
    # Same code is fine in a different organization.
    assert client.post("/api/assets", json={"code": "FL-08", "name": "Forklift"}, headers=auth("user_stranger")).status_code == 201


def test_qr_check_issue_and_maintenance_flow(client):
    onboard(client)
    h = auth("user_admin")
    asset = client.post("/api/assets", json={"code": "mx-12", "name": "Mixer", "checklist": ["Guards in place", "No leaks"]}, headers=h).json()
    assert asset["code"] == "MX-12"
    assert client.post("/api/assets", json={"code": "MX-12", "name": "Dup"}, headers=h).status_code == 409

    token = asset["qr_token"]
    public = client.get(f"/api/public/{token}").json()
    answers = [{"item_id": i["id"], "ok": n == 0, "note": "dripping" if n else ""} for n, i in enumerate(public["checklist"])]
    res = client.post(f"/api/public/{token}/inspections", data={"payload": json.dumps({"inspector_name": "Bilal", "answers": answers})})
    assert res.json()["asset_status"] == "attention"

    res = client.post(f"/api/public/{token}/issues", data={"reporter_name": "Bilal", "title": "Brakes", "severity": "high"})
    assert res.json()["asset_status"] == "out_of_service"

    detail = client.get(f"/api/assets/{asset['id']}", headers=h).json()
    open_ids = [i["id"] for i in detail["issues"] if i["status"] == "open"]
    assert len(open_ids) == 2
    res = client.post(f"/api/assets/{asset['id']}/maintenance", json={"description": "Fixed", "performed_by": "Mech", "resolve_issue_ids": open_ids}, headers=h)
    assert res.json()["status"] == "operational"

    dash = client.get("/api/dashboard", headers=h).json()
    assert dash["total_assets"] == 1 and dash["open_issues"] == 0 and dash["failed_7d"] == 1
    titles = [e["title"] for e in client.get(f"/api/assets/{asset['id']}/timeline", headers=h).json()]
    assert titles[0] == "Back in operation" and "Asset registered" in titles


def test_report_qr_shows_full_history_and_can_be_reset(client):
    onboard(client)
    onboard(client, sub="user_stranger", org="Other Co")
    h = auth("user_admin")
    asset = client.post("/api/assets", json={"code": "gn-02", "name": "Generator", "checklist": ["Fuel above 25%"]}, headers=h).json()
    assert asset["report_token"] and asset["report_token"] != asset["qr_token"]

    item = client.get(f"/api/public/{asset['qr_token']}").json()["checklist"][0]["id"]
    for ok in (True, False):
        payload = {"inspector_name": "Bilal", "answers": [{"item_id": item, "ok": ok}]}
        client.post(f"/api/public/{asset['qr_token']}/inspections", data={"payload": json.dumps(payload)})
    issue_id = client.get(f"/api/assets/{asset['id']}", headers=h).json()["issues"][0]["id"]
    client.post(f"/api/assets/{asset['id']}/maintenance", json={"description": "Refuelled", "performed_by": "Mech", "resolve_issue_ids": [issue_id]}, headers=h)

    report = client.get(f"/api/public/report/{asset['report_token']}").json()
    assert report["organization_name"] == "Acme Plant" and report["code"] == "GN-02" and report["status"] == "operational"
    assert report["stats"] == {
        **report["stats"],
        "total_checks": 2, "failed_checks": 1, "pass_rate": 0.5, "open_issues": 0, "resolved_issues": 1, "maintenance_count": 1,
    }
    assert [i["passed"] for i in report["inspections"]] == [False, True]  # newest first
    assert report["maintenance"][0]["description"] == "Refuelled"
    assert report["events"][-1]["title"] == "Asset registered"

    # The check token is not a report token, and vice versa.
    assert client.get(f"/api/public/report/{asset['qr_token']}").status_code == 404
    assert client.get(f"/api/public/{asset['report_token']}").status_code == 404

    # Only an admin of the same organization can reset; the old link then stops working.
    assert client.post(f"/api/assets/{asset['id']}/report-link/reset", headers=auth("user_stranger")).status_code == 404
    new = client.post(f"/api/assets/{asset['id']}/report-link/reset", headers=h).json()
    assert new["report_token"] != asset["report_token"] and new["qr_token"] == asset["qr_token"]
    assert client.get(f"/api/public/report/{asset['report_token']}").status_code == 404
    assert client.get(f"/api/public/report/{new['report_token']}").status_code == 200


def test_manual_out_of_service_opens_an_issue(client):
    onboard(client)
    h = auth("user_admin")
    asset = client.post("/api/assets", json={"code": "fl-22", "name": "Forklift"}, headers=h).json()

    res = client.patch(f"/api/assets/{asset['id']}", json={"status": "out_of_service", "status_reason": "Mast chain snapped"}, headers=h).json()
    assert res["status"] == "out_of_service"
    issues = client.get("/api/issues", headers=h).json()
    assert [(i["asset_code"], i["severity"], i["title"]) for i in issues] == [("FL-22", "high", "Out of service: Mast chain snapped")]

    # Doing it again (or flagging for attention) doesn't pile up duplicates.
    client.patch(f"/api/assets/{asset['id']}", json={"status": "attention"}, headers=h)
    client.patch(f"/api/assets/{asset['id']}", json={"status": "out_of_service"}, headers=h)
    assert len(client.get("/api/issues", headers=h).json()) == 1

    # Fixing it through maintenance puts the asset back in operation.
    res = client.post(f"/api/assets/{asset['id']}/maintenance", json={"description": "New chain", "performed_by": "Mech", "resolve_issue_ids": [issues[0]["id"]]}, headers=h)
    assert res.json()["status"] == "operational"
    assert client.get("/api/issues", headers=h).json() == []


def test_manual_attention_opens_medium_issue(client):
    onboard(client)
    h = auth("user_admin")
    asset = client.post("/api/assets", json={"code": "cr-04", "name": "Crane"}, headers=h).json()
    client.patch(f"/api/assets/{asset['id']}", json={"status": "attention"}, headers=h)
    issues = client.get("/api/issues", headers=h).json()
    assert [(i["severity"], i["title"]) for i in issues] == [("medium", "Needs attention (set manually)")]


PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_asset_photos_show_on_lists_and_qr_pages(client):
    onboard(client)
    onboard(client, sub="user_stranger", org="Other Co")
    h = auth("user_admin")
    asset = client.post("/api/assets", json={"code": "fl-08", "name": "Forklift"}, headers=h).json()
    assert asset["photos"] == [] and asset["cover_url"] is None

    for name in ("front.png", "side.png"):
        res = client.post(f"/api/assets/{asset['id']}/photos", files={"photo": (name, PNG, "image/png")}, headers=h)
        assert res.status_code == 201, res.text
    detail = res.json()
    urls = [p["url"] for p in detail["photos"]]
    assert len(urls) == 2 and detail["cover_url"] == urls[0]
    assert client.get(urls[0]).status_code == 200  # served from /api/uploads

    # Shown in the asset list (cover), on the check QR page and in the report.
    assert client.get("/api/assets", headers=h).json()[0]["cover_url"] == urls[0]
    assert client.get(f"/api/public/{asset['qr_token']}").json()["photos"] == urls
    assert client.get(f"/api/public/report/{asset['report_token']}").json()["photos"] == urls

    # Validation and isolation.
    bad = client.post(f"/api/assets/{asset['id']}/photos", files={"photo": ("x.txt", b"hello", "text/plain")}, headers=h)
    assert bad.status_code == 400
    other = client.post(f"/api/assets/{asset['id']}/photos", files={"photo": ("a.png", PNG, "image/png")}, headers=auth("user_stranger"))
    assert other.status_code == 404

    # Deleting the cover promotes the next photo and removes the file.
    after = client.delete(f"/api/assets/{asset['id']}/photos/{detail['photos'][0]['id']}", headers=h).json()
    assert [p["url"] for p in after["photos"]] == urls[1:] and after["cover_url"] == urls[1]
    assert client.get(urls[0]).status_code == 404
