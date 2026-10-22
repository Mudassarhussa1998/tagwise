"""Endpoints opened from an asset's QR codes. No login: the unguessable token is the key.

Each asset has two: `qr_token` (run a check / report a failure) and `report_token`
(read-only full history).
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Asset, Event, Inspection, InspectionAnswer, Issue, Maintenance, Organization, utcnow
from ..schemas import AssetReport, InspectionIn, PublicAsset, PublicResult, ReportStats, Severity
from ..services import add_event, last_inspections, refresh_status, save_photo

router = APIRouter(prefix="/api/public", tags=["public"])


def asset_by_token(db: Session, token: str) -> Asset:
    asset = db.scalar(select(Asset).where(Asset.qr_token == token))
    if asset is None:
        raise HTTPException(404, "This QR code is not linked to any asset")
    return asset


@router.get("/report/{report_token}", response_model=AssetReport)
def asset_report(report_token: str, db: Session = Depends(get_db)):
    asset = db.scalar(select(Asset).where(Asset.report_token == report_token))
    if asset is None:
        raise HTTPException(404, "This report link is invalid or has been reset")

    inspections = db.scalars(
        select(Inspection)
        .options(selectinload(Inspection.answers))
        .where(Inspection.asset_id == asset.id)
        .order_by(Inspection.created_at.desc())
    ).all()
    issues = db.scalars(select(Issue).where(Issue.asset_id == asset.id).order_by(Issue.created_at.desc())).all()
    maintenance = db.scalars(
        select(Maintenance).where(Maintenance.asset_id == asset.id).order_by(Maintenance.created_at.desc())
    ).all()
    events = db.scalars(
        select(Event).where(Event.asset_id == asset.id).order_by(Event.created_at.desc(), Event.id.desc()).limit(500)
    ).all()

    failed = sum(1 for i in inspections if not i.passed)
    return AssetReport(
        organization_name=db.get(Organization, asset.org_id).name,
        code=asset.code,
        name=asset.name,
        category=asset.category,
        location=asset.location,
        owner_name=asset.owner_name,
        status=asset.status,
        registered_at=asset.created_at,
        generated_at=utcnow(),
        photos=[p.url for p in asset.photos],
        stats=ReportStats(
            total_checks=len(inspections),
            failed_checks=failed,
            pass_rate=(len(inspections) - failed) / len(inspections) if inspections else None,
            open_issues=sum(1 for i in issues if i.status == "open"),
            resolved_issues=sum(1 for i in issues if i.status == "resolved"),
            maintenance_count=len(maintenance),
            last_check_at=inspections[0].created_at if inspections else None,
            last_maintenance_at=maintenance[0].created_at if maintenance else None,
        ),
        checklist=asset.checklist,
        issues=issues,
        maintenance=maintenance,
        inspections=inspections[:100],
        events=events,
    )


@router.get("/{token}", response_model=PublicAsset)
def public_asset(token: str, db: Session = Depends(get_db)):
    asset = asset_by_token(db, token)
    last = last_inspections(db, [asset.id]).get(asset.id)
    return PublicAsset(
        code=asset.code,
        name=asset.name,
        category=asset.category,
        location=asset.location,
        status=asset.status,
        organization_name=db.get(Organization, asset.org_id).name,
        photos=[p.url for p in asset.photos],
        checklist=asset.checklist,
        open_issues=db.scalar(select(func.count()).select_from(Issue).where(Issue.asset_id == asset.id, Issue.status == "open")) or 0,
        last_inspection_at=last.created_at if last else None,
    )


@router.post("/{token}/inspections", response_model=PublicResult, status_code=201)
async def submit_inspection(
    token: str,
    payload: str = Form(..., description="JSON body matching InspectionIn"),
    photo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    asset = asset_by_token(db, token)
    try:
        body = InspectionIn.model_validate_json(payload)
    except ValidationError as e:
        raise HTTPException(422, e.errors(include_url=False, include_context=False))

    items = {i.id: i for i in asset.checklist}
    if any(a.item_id not in items for a in body.answers):
        raise HTTPException(422, "Checklist changed; reload the page and try again")
    photo_url = await save_photo(photo)
    failed = [a for a in body.answers if not a.ok]

    inspection = Inspection(
        asset_id=asset.id,
        inspector_name=body.inspector_name.strip(),
        passed=not failed,
        notes=body.notes,
        photo_url=photo_url,
        answers=[InspectionAnswer(question=items[a.item_id].question, ok=a.ok, note=a.note) for a in body.answers],
    )
    db.add(inspection)
    db.flush()

    if failed:
        questions = [items[a.item_id].question for a in failed]
        notes = [f"{items[a.item_id].question}: {a.note}" for a in failed if a.note]
        db.add(
            Issue(
                asset_id=asset.id,
                inspection_id=inspection.id,
                title=f"Failed check: {', '.join(questions)}"[:200],
                description="\n".join(notes + ([body.notes] if body.notes else [])),
                severity="medium",
                reported_by=inspection.inspector_name,
                photo_url=photo_url,
            )
        )
        add_event(
            db, asset, "inspection", f"Control failed ({len(failed)} of {len(body.answers)} items)",
            level="danger", detail="\n".join(questions), actor=inspection.inspector_name, photo_url=photo_url,
        )
    else:
        add_event(
            db, asset, "inspection", "Control passed", level="ok",
            detail=body.notes or "No observations", actor=inspection.inspector_name, photo_url=photo_url,
        )
    refresh_status(db, asset, actor=inspection.inspector_name)
    db.commit()
    message = "Issue reported. Your supervisor has been notified." if failed else "Everything looks good. Thanks!"
    return PublicResult(ok=not failed, message=message, asset_status=asset.status)


@router.post("/{token}/issues", response_model=PublicResult, status_code=201)
async def report_issue(
    token: str,
    reporter_name: str = Form(..., min_length=1, max_length=120),
    title: str = Form(..., min_length=1, max_length=200),
    description: str = Form("", max_length=4000),
    severity: Severity = Form("medium"),
    photo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    asset = asset_by_token(db, token)
    photo_url = await save_photo(photo)
    db.add(Issue(asset_id=asset.id, title=title.strip(), description=description, severity=severity, reported_by=reporter_name.strip(), photo_url=photo_url))
    add_event(
        db, asset, "issue", f"Failure reported: {title.strip()}", level="danger" if severity == "high" else "warn",
        detail=description, actor=reporter_name.strip(), photo_url=photo_url,
    )
    refresh_status(db, asset, actor=reporter_name.strip())
    db.commit()
    return PublicResult(ok=True, message="Failure reported. Your supervisor has been notified.", asset_status=asset.status)
