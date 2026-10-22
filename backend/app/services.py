import uuid

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database import UPLOAD_DIR
from .models import Asset, AssetPhoto, Event, Inspection, Issue

DEFAULT_CHECKLIST = [
    "General visual condition is good",
    "No leaks (oil, fuel, hydraulic)",
    "Safety devices and alarms work",
    "Controls and brakes respond correctly",
]

ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/heic": ".heic"}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024


def add_event(
    db: Session,
    asset: Asset,
    kind: str,
    title: str,
    *,
    level: str = "info",
    detail: str = "",
    actor: str = "",
    photo_url: str | None = None,
) -> Event:
    event = Event(
        asset_id=asset.id,
        org_id=asset.org_id,
        kind=kind,
        level=level,
        title=title,
        detail=detail,
        actor=actor,
        photo_url=photo_url,
    )
    db.add(event)
    return event


def refresh_status(db: Session, asset: Asset, actor: str = "") -> None:
    """Derive the asset's status from its open issues and log a change."""
    db.flush()
    severities = db.scalars(
        select(Issue.severity).where(Issue.asset_id == asset.id, Issue.status == "open")
    ).all()
    if "high" in severities:
        new_status = "out_of_service"
    elif severities:
        new_status = "attention"
    else:
        new_status = "operational"
    if new_status != asset.status:
        labels = {"operational": "Back in operation", "attention": "Needs attention", "out_of_service": "Out of service"}
        level = {"operational": "ok", "attention": "warn", "out_of_service": "danger"}[new_status]
        asset.status = new_status
        add_event(db, asset, "status", labels[new_status], level=level, actor=actor)


STATUS_ISSUE = {
    # status -> (severity, title)
    "out_of_service": ("high", "Out of service"),
    "attention": ("medium", "Needs attention"),
}


def open_issue_for_status(db: Session, asset: Asset, status: str, reason: str, actor: str) -> Issue | None:
    """A manual 'out of service' / 'needs attention' must show up on the Issues list.

    Opens an issue unless one of at least that severity is already open, so resolving
    it with maintenance brings the asset back to operational, like any other issue.
    """
    if status not in STATUS_ISSUE:
        return None
    severity, title = STATUS_ISSUE[status]
    wanted = {"high"} if severity == "high" else {"high", "medium"}
    already = db.scalar(
        select(func.count()).select_from(Issue).where(Issue.asset_id == asset.id, Issue.status == "open", Issue.severity.in_(wanted))
    )
    if already:
        return None
    issue = Issue(
        asset_id=asset.id,
        title=f"{title}: {reason}"[:200] if reason else f"{title} (set manually)",
        description=reason,
        severity=severity,
        reported_by=actor,
    )
    db.add(issue)
    add_event(db, asset, "issue", f"Issue opened: {issue.title}", level="danger" if severity == "high" else "warn", detail=reason, actor=actor)
    return issue


def open_issue_counts(db: Session, asset_ids: list[int]) -> dict[int, int]:
    if not asset_ids:
        return {}
    rows = db.execute(
        select(Issue.asset_id, func.count())
        .where(Issue.asset_id.in_(asset_ids), Issue.status == "open")
        .group_by(Issue.asset_id)
    ).all()
    return dict(rows)


def last_inspections(db: Session, asset_ids: list[int]) -> dict[int, Inspection]:
    if not asset_ids:
        return {}
    latest = (
        select(Inspection.asset_id, func.max(Inspection.id).label("max_id"))
        .where(Inspection.asset_id.in_(asset_ids))
        .group_by(Inspection.asset_id)
        .subquery()
    )
    rows = db.scalars(select(Inspection).join(latest, Inspection.id == latest.c.max_id)).all()
    return {i.asset_id: i for i in rows}


def cover_photos(db: Session, asset_ids: list[int]) -> dict[int, str]:
    if not asset_ids:
        return {}
    first = select(AssetPhoto.asset_id, func.min(AssetPhoto.id).label("min_id")).where(AssetPhoto.asset_id.in_(asset_ids)).group_by(AssetPhoto.asset_id).subquery()
    return dict(db.execute(select(AssetPhoto.asset_id, AssetPhoto.url).join(first, AssetPhoto.id == first.c.min_id)).all())


def summarize(db: Session, assets: list[Asset]) -> list[dict]:
    ids = [a.id for a in assets]
    counts = open_issue_counts(db, ids)
    lasts = last_inspections(db, ids)
    covers = cover_photos(db, ids)
    out = []
    for a in assets:
        last = lasts.get(a.id)
        out.append(
            {
                **{c: getattr(a, c) for c in ("id", "code", "name", "category", "location", "owner_name", "status", "qr_token", "report_token", "created_at")},
                "open_issues": counts.get(a.id, 0),
                "last_inspection_at": last.created_at if last else None,
                "last_inspection_passed": last.passed if last else None,
                "cover_url": covers.get(a.id),
            }
        )
    return out


async def save_photo(photo: UploadFile | None) -> str | None:
    if photo is None or not photo.filename:
        return None
    ext = ALLOWED_IMAGE_TYPES.get(photo.content_type or "")
    if ext is None:
        raise HTTPException(400, "Photo must be a JPEG, PNG, WEBP or HEIC image")
    data = await photo.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Photo is larger than 8 MB")
    name = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    return f"/api/uploads/{name}"
