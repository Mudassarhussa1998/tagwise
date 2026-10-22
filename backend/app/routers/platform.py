"""Platform admin: a site-wide view across every company, for the people in PLATFORM_ADMIN_EMAILS."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Asset, Event, Inspection, Invite, Issue, Organization, User, utcnow
from ..schemas import PlatformCompany, PlatformOverview, PlatformSignup, PlatformSignups, PlatformTotals, PlatformUser
from ..security import list_clerk_users, profile_from_clerk_user, require_platform_admin

router = APIRouter(prefix="/api/platform", tags=["platform"], dependencies=[Depends(require_platform_admin)])


def _count(db: Session, stmt) -> int:
    return db.scalar(stmt) or 0


def _companies(db: Session, limit: int | None = None) -> list[PlatformCompany]:
    def per_org(column, *where):
        return select(column.label("org_id"), func.count().label("n")).where(*where).group_by(column).subquery()

    users = per_org(User.org_id)
    admins = per_org(User.org_id, User.role == "admin")
    assets = per_org(Asset.org_id)
    checks = select(Asset.org_id.label("org_id"), func.count().label("n")).join(Inspection, Inspection.asset_id == Asset.id).group_by(Asset.org_id).subquery()
    open_issues = (
        select(Asset.org_id.label("org_id"), func.count().label("n"))
        .join(Issue, Issue.asset_id == Asset.id)
        .where(Issue.status == "open")
        .group_by(Asset.org_id)
        .subquery()
    )
    activity = select(Event.org_id.label("org_id"), func.max(Event.created_at).label("at")).group_by(Event.org_id).subquery()

    stmt = (
        select(
            Organization,
            func.coalesce(users.c.n, 0),
            func.coalesce(admins.c.n, 0),
            func.coalesce(assets.c.n, 0),
            func.coalesce(checks.c.n, 0),
            func.coalesce(open_issues.c.n, 0),
            activity.c.at,
        )
        .outerjoin(users, users.c.org_id == Organization.id)
        .outerjoin(admins, admins.c.org_id == Organization.id)
        .outerjoin(assets, assets.c.org_id == Organization.id)
        .outerjoin(checks, checks.c.org_id == Organization.id)
        .outerjoin(open_issues, open_issues.c.org_id == Organization.id)
        .outerjoin(activity, activity.c.org_id == Organization.id)
        .order_by(Organization.created_at.desc(), Organization.id.desc())
        .limit(limit)
    )
    return [
        PlatformCompany(
            id=org.id,
            name=org.name,
            created_at=org.created_at,
            users=n_users,
            admins=n_admins,
            assets=n_assets,
            inspections=n_checks,
            open_issues=n_issues,
            last_activity=last,
        )
        for org, n_users, n_admins, n_assets, n_checks, n_issues, last in db.execute(stmt).all()
    ]


def _users(db: Session, limit: int | None = None) -> list[PlatformUser]:
    rows = db.execute(
        select(User, Organization.name).join(Organization, Organization.id == User.org_id).order_by(User.created_at.desc(), User.id.desc()).limit(limit)
    ).all()
    return [
        PlatformUser(id=u.id, name=u.name, email=u.email, role=u.role, company_id=u.org_id, company_name=org_name, created_at=u.created_at)
        for u, org_name in rows
    ]


@router.get("/overview", response_model=PlatformOverview)
def overview(db: Session = Depends(get_db)):
    week_ago = utcnow() - timedelta(days=7)
    totals = PlatformTotals(
        companies=_count(db, select(func.count()).select_from(Organization)),
        users=_count(db, select(func.count()).select_from(User)),
        assets=_count(db, select(func.count()).select_from(Asset)),
        inspections=_count(db, select(func.count()).select_from(Inspection)),
        open_issues=_count(db, select(func.count()).select_from(Issue).where(Issue.status == "open")),
        pending_invites=_count(db, select(func.count()).select_from(Invite)),
        companies_7d=_count(db, select(func.count()).select_from(Organization).where(Organization.created_at >= week_ago)),
        users_7d=_count(db, select(func.count()).select_from(User).where(User.created_at >= week_ago)),
        inspections_7d=_count(db, select(func.count()).select_from(Inspection).where(Inspection.created_at >= week_ago)),
    )
    return PlatformOverview(totals=totals, recent_companies=_companies(db, limit=5), recent_users=_users(db, limit=5))


@router.get("/companies", response_model=list[PlatformCompany])
def companies(db: Session = Depends(get_db)):
    return _companies(db)


@router.get("/users", response_model=list[PlatformUser])
def users(db: Session = Depends(get_db)):
    return _users(db)


def _from_ms(ms: int | None) -> datetime | None:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).replace(tzinfo=None) if ms else None


@router.get("/signups", response_model=PlatformSignups)
def signups(db: Session = Depends(get_db)):
    """Newest Clerk accounts that never created or joined a company."""
    clerk_users, total = list_clerk_users()
    known = set(db.scalars(select(User.clerk_id)).all())
    pending = []
    for data in clerk_users:
        if data.get("id") in known:
            continue
        profile = profile_from_clerk_user(data)
        pending.append(
            PlatformSignup(
                clerk_id=data["id"],
                name=profile.name,
                email=profile.email or "(email not verified)",
                created_at=_from_ms(data.get("created_at")),
                last_sign_in_at=_from_ms(data.get("last_sign_in_at")),
            )
        )
    return PlatformSignups(clerk_total=total, without_company=pending)
