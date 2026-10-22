"""Create a demo organization with sample assets.

    alembic upgrade head
    python seed.py you@company.com

Sign-in is handled by Clerk, so this doesn't create a login. It invites the given
email as an admin: the first time you sign in with that (verified) email, you join
the demo organization.
"""

import sys
from datetime import timedelta

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Asset, ChecklistItem, Event, Inspection, InspectionAnswer, Invite, Issue, Organization, utcnow

DEMO_ORG = "Demo Industries"

ASSETS = [
    ("FL-08", "Toyota forklift", "Forklift", "Central warehouse", "Ali Raza",
     ["Forks and chains in good condition", "No hydraulic leaks", "Horn and lights work", "Brakes respond correctly", "Seat belt works"]),
    ("CR-04", "Overhead crane 10t", "Crane", "Assembly bay 2", "Sara Khan",
     ["Hook and latch intact", "Wire rope has no damage", "Limit switches work", "Emergency stop works"]),
    ("MX-12", "Concrete mixer", "Mixer", "Yard B", "",
     ["Drum rotates freely", "No oil leaks", "Guards in place", "Emergency stop works"]),
    ("GN-02", "Diesel generator 250kVA", "Generator", "Power room", "Usman Tariq",
     ["Fuel level above 25%", "Coolant level OK", "No unusual noise", "Battery terminals clean"]),
]


def main(email: str):
    db = SessionLocal()
    if db.scalar(select(Organization).where(Organization.name == DEMO_ORG)):
        print("Demo data already exists.")
        return

    org = Organization(name=DEMO_ORG)
    db.add(org)
    db.flush()
    db.add(Invite(org_id=org.id, email=email.lower(), role="admin", invited_by="seed script"))
    now = utcnow()

    for n, (code, name, category, location, owner, checklist) in enumerate(ASSETS):
        start = now - timedelta(days=40 - n)
        asset = Asset(org_id=org.id, code=code, name=name, category=category, location=location, owner_name=owner, created_at=start,
                      checklist=[ChecklistItem(question=q, position=i) for i, q in enumerate(checklist)])
        db.add(asset)
        db.flush()
        db.add(Event(asset_id=asset.id, org_id=org.id, kind="registered", level="ok", title="Asset registered",
                     detail=f"QR {code} assigned", actor="Demo Admin", created_at=start))
        for day in (30, 20, 10, 1):
            when = now - timedelta(days=day, hours=n)
            db.add(Inspection(asset_id=asset.id, inspector_name="Bilal Ahmed", passed=True, created_at=when,
                              answers=[InspectionAnswer(question=q, ok=True) for q in checklist]))
            db.add(Event(asset_id=asset.id, org_id=org.id, kind="inspection", level="ok", title="Control passed",
                         detail="No observations", actor="Bilal Ahmed", created_at=when))

    # One asset with an open problem so the dashboard has something to show.
    mixer = db.scalar(select(Asset).where(Asset.code == "MX-12"))
    when = now - timedelta(hours=3)
    insp = Inspection(asset_id=mixer.id, inspector_name="Hamza Iqbal", passed=False, notes="Oil dripping under gearbox", created_at=when,
                      answers=[InspectionAnswer(question=c.question, ok=c.question != "No oil leaks") for c in mixer.checklist])
    db.add(insp)
    db.flush()
    db.add(Issue(asset_id=mixer.id, inspection_id=insp.id, title="Failed check: No oil leaks", description="Oil dripping under gearbox",
                 severity="medium", reported_by="Hamza Iqbal", created_at=when))
    db.add_all([
        Event(asset_id=mixer.id, org_id=org.id, kind="inspection", level="danger", title="Control failed (1 of 4 items)",
              detail="No oil leaks", actor="Hamza Iqbal", created_at=when),
        Event(asset_id=mixer.id, org_id=org.id, kind="status", level="warn", title="Needs attention", actor="Hamza Iqbal", created_at=when),
    ])
    mixer.status = "attention"
    db.commit()
    print(f"Seeded {DEMO_ORG}. Sign in with {email} to join it as an admin.")


if __name__ == "__main__":
    if len(sys.argv) != 2 or "@" not in sys.argv[1]:
        sys.exit("Usage: python seed.py you@company.com")
    main(sys.argv[1])
