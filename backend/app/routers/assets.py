from datetime import timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from .. import storage
from ..models import Asset, AssetPhoto, ChecklistItem, Event, Inspection, Issue, Maintenance, User, new_qr_token, utcnow
from ..schemas import (
    AssetCreate,
    AssetDetail,
    AssetSummary,
    AssetUpdate,
    ChecklistIn,
    DashboardOut,
    EventOut,
    EventWithAsset,
    InspectionOut,
    IssueWithAsset,
    MaintenanceIn,
)
from ..security import get_current_user, require_admin
from ..services import DEFAULT_CHECKLIST, add_event, open_issue_for_status, refresh_status, save_photo, summarize

router = APIRouter(prefix="/api", tags=["assets"])


def get_asset(db: Session, user: User, asset_id: int) -> Asset:
    asset = db.get(Asset, asset_id)
    if asset is None or asset.org_id != user.org_id:
        raise HTTPException(404, "Asset not found")
    return asset


def asset_detail(db: Session, asset: Asset) -> AssetDetail:
    summary = summarize(db, [asset])[0]
    issues = db.scalars(
        select(Issue).where(Issue.asset_id == asset.id).order_by(Issue.status, Issue.created_at.desc()).limit(50)
    ).all()
    inspection_count = db.scalar(select(func.count()).select_from(Inspection).where(Inspection.asset_id == asset.id))
    return AssetDetail(**summary, photos=asset.photos, checklist=asset.checklist, issues=issues, inspection_count=inspection_count or 0)


def set_checklist(asset: Asset, questions: list[str]) -> None:
    cleaned = [q.strip() for q in questions if q.strip()]
    if not cleaned:
        raise HTTPException(422, "Checklist needs at least one item")
    asset.checklist = [ChecklistItem(question=q[:255], position=i) for i, q in enumerate(cleaned)]


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = user.org_id
    by_status = dict(db.execute(select(Asset.status, func.count()).where(Asset.org_id == org).group_by(Asset.status)).all())
    now = utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    org_inspections = select(func.count()).select_from(Inspection).join(Asset).where(Asset.org_id == org)
    attention = db.scalars(
        select(Asset).where(Asset.org_id == org, Asset.status != "operational").order_by(Asset.status.desc(), Asset.code)
    ).all()
    events = db.execute(
        select(Event, Asset.code, Asset.name)
        .join(Asset)
        .where(Event.org_id == org)
        .order_by(Event.created_at.desc(), Event.id.desc())
        .limit(50)
    ).all()
    return DashboardOut(
        total_assets=sum(by_status.values()),
        by_status={s: by_status.get(s, 0) for s in ("operational", "attention", "out_of_service")},
        open_issues=db.scalar(select(func.count()).select_from(Issue).join(Asset).where(Asset.org_id == org, Issue.status == "open")) or 0,
        inspections_today=db.scalar(org_inspections.where(Inspection.created_at >= today)) or 0,
        inspections_7d=db.scalar(org_inspections.where(Inspection.created_at >= now - timedelta(days=7))) or 0,
        failed_7d=db.scalar(org_inspections.where(Inspection.created_at >= now - timedelta(days=7), Inspection.passed.is_(False))) or 0,
        attention_assets=summarize(db, list(attention)),
        recent_events=[
            EventWithAsset(**EventOut.model_validate(e).model_dump(), asset_code=code, asset_name=name) for e, code, name in events
        ],
    )


@router.get("/assets", response_model=list[AssetSummary])
def list_assets(
    q: str | None = None,
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Asset).where(Asset.org_id == user.org_id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Asset.code.ilike(like), Asset.name.ilike(like), Asset.location.ilike(like), Asset.category.ilike(like)))
    if status:
        stmt = stmt.where(Asset.status == status)
    return summarize(db, list(db.scalars(stmt.order_by(Asset.code)).all()))


@router.post("/assets", response_model=AssetDetail, status_code=201)
def create_asset(body: AssetCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    asset = Asset(org_id=user.org_id, **body.model_dump(exclude={"checklist"}))
    asset.code = asset.code.strip().upper()
    set_checklist(asset, body.checklist or DEFAULT_CHECKLIST)
    db.add(asset)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, f"Asset code {asset.code} already exists")
    add_event(db, asset, "registered", "Asset registered", level="ok", detail=f"QR {asset.code} assigned", actor=user.name)
    db.commit()
    return asset_detail(db, asset)


@router.get("/assets/{asset_id}", response_model=AssetDetail)
def read_asset(asset_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return asset_detail(db, get_asset(db, user, asset_id))


@router.patch("/assets/{asset_id}", response_model=AssetDetail)
def update_asset(asset_id: int, body: AssetUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    asset = get_asset(db, user, asset_id)
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    new_status = changes.pop("status", None)
    reason = changes.pop("status_reason", "").strip()
    if "code" in changes:
        changes["code"] = changes["code"].strip().upper()
    for field, value in changes.items():
        setattr(asset, field, value)
    if new_status and new_status != asset.status:
        asset.status = new_status
        labels = {"operational": "Marked operational", "attention": "Flagged for attention", "out_of_service": "Taken out of service"}
        level = {"operational": "ok", "attention": "warn", "out_of_service": "danger"}[new_status]
        add_event(db, asset, "status", labels[new_status], level=level, actor=user.name, detail=reason or "Manual status change")
        open_issue_for_status(db, asset, new_status, reason, user.name)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Asset code already exists")
    return asset_detail(db, asset)


@router.delete("/assets/{asset_id}", status_code=204)
def delete_asset(asset_id: int, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    db.delete(get_asset(db, user, asset_id))
    db.commit()


@router.put("/assets/{asset_id}/checklist", response_model=AssetDetail)
def replace_checklist(asset_id: int, body: ChecklistIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    asset = get_asset(db, user, asset_id)
    set_checklist(asset, body.items)
    db.commit()
    return asset_detail(db, asset)


MAX_ASSET_PHOTOS = 8


@router.post("/assets/{asset_id}/photos", response_model=AssetDetail, status_code=201)
async def add_asset_photo(asset_id: int, photo: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Add a picture of the asset. The first photo is used as the cover."""
    asset = get_asset(db, user, asset_id)
    if len(asset.photos) >= MAX_ASSET_PHOTOS:
        raise HTTPException(400, f"An asset can have up to {MAX_ASSET_PHOTOS} photos. Remove one first.")
    url = await save_photo(photo)
    if url is None:
        raise HTTPException(422, "Choose a photo to upload")
    asset.photos.append(AssetPhoto(url=url))
    db.commit()
    return asset_detail(db, asset)


@router.delete("/assets/{asset_id}/photos/{photo_id}", response_model=AssetDetail)
def delete_asset_photo(asset_id: int, photo_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    asset = get_asset(db, user, asset_id)
    photo = db.get(AssetPhoto, photo_id)
    if photo is None or photo.asset_id != asset.id:
        raise HTTPException(404, "Photo not found")
    storage.delete(photo.url)
    asset.photos.remove(photo)
    db.commit()
    return asset_detail(db, asset)


@router.post("/assets/{asset_id}/report-link/reset", response_model=AssetDetail)
def reset_report_link(asset_id: int, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Issue a new report token. The old report QR and link stop working immediately."""
    asset = get_asset(db, user, asset_id)
    asset.report_token = new_qr_token()
    add_event(db, asset, "status", "Report link reset", detail="Previous report QR codes no longer work", actor=user.name)
    db.commit()
    return asset_detail(db, asset)


@router.get("/assets/{asset_id}/timeline", response_model=list[EventOut])
def timeline(asset_id: int, limit: int = Query(100, le=500), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_asset(db, user, asset_id)
    return db.scalars(
        select(Event).where(Event.asset_id == asset_id).order_by(Event.created_at.desc(), Event.id.desc()).limit(limit)
    ).all()


@router.get("/assets/{asset_id}/inspections", response_model=list[InspectionOut])
def inspections(asset_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_asset(db, user, asset_id)
    return db.scalars(
        select(Inspection)
        .options(selectinload(Inspection.answers))
        .where(Inspection.asset_id == asset_id)
        .order_by(Inspection.created_at.desc())
        .limit(100)
    ).all()


@router.post("/assets/{asset_id}/maintenance", response_model=AssetDetail, status_code=201)
def record_maintenance(asset_id: int, body: MaintenanceIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    asset = get_asset(db, user, asset_id)
    db.add(Maintenance(asset_id=asset.id, kind=body.kind, description=body.description, performed_by=body.performed_by))
    resolved = []
    if body.resolve_issue_ids:
        issues = db.scalars(
            select(Issue).where(Issue.asset_id == asset.id, Issue.id.in_(body.resolve_issue_ids), Issue.status == "open")
        ).all()
        for issue in issues:
            issue.status = "resolved"
            issue.resolved_at = utcnow()
            resolved.append(issue.title)
    detail = body.description + (f"\nResolved: {'; '.join(resolved)}" if resolved else "")
    add_event(db, asset, "maintenance", f"{body.kind.capitalize()} maintenance completed", level="ok", detail=detail, actor=body.performed_by)
    refresh_status(db, asset, actor=user.name)
    db.commit()
    return asset_detail(db, asset)


@router.get("/issues", response_model=list[IssueWithAsset])
def list_issues(status: str | None = "open", user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Issue, Asset.code, Asset.name).join(Asset).where(Asset.org_id == user.org_id)
    if status:
        stmt = stmt.where(Issue.status == status)
    rows = db.execute(stmt.order_by(Issue.created_at.desc()).limit(200)).all()
    return [IssueWithAsset(**{**i.__dict__, "asset_code": code, "asset_name": name}) for i, code, name in rows]
