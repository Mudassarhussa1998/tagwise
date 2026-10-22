from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, PlainSerializer

# Datetimes are stored as naive UTC; send them to clients with an explicit offset.
UTCDatetime = Annotated[
    datetime, PlainSerializer(lambda d: d.replace(tzinfo=timezone.utc).isoformat(), return_type=str)
]

AssetStatus = Literal["operational", "attention", "out_of_service"]
Severity = Literal["low", "medium", "high"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- auth / users ----

class UserOut(ORM):
    id: int
    name: str
    email: str
    role: str
    created_at: UTCDatetime


class MeOut(UserOut):
    organization_name: str


class SessionOut(BaseModel):
    """`user` is null when the Clerk account isn't part of an organization yet."""

    user: MeOut | None
    email: str = ""


class OnboardIn(BaseModel):
    organization: str = Field(min_length=2, max_length=160)


class InviteIn(BaseModel):
    email: EmailStr
    role: Literal["admin", "member"] = "member"


class InviteOut(ORM):
    id: int
    email: str
    role: str
    invited_by: str
    created_at: UTCDatetime


# ---- assets ----

class AssetBase(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=160)
    category: str = Field(default="", max_length=80)
    location: str = Field(default="", max_length=160)
    owner_name: str = Field(default="", max_length=120)


class AssetCreate(AssetBase):
    checklist: list[str] | None = None


class AssetUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=40)
    name: str | None = Field(default=None, min_length=1, max_length=160)
    category: str | None = Field(default=None, max_length=80)
    location: str | None = Field(default=None, max_length=160)
    owner_name: str | None = Field(default=None, max_length=120)
    status: AssetStatus | None = None
    # Why the status was changed by hand; becomes the issue description.
    status_reason: str = Field(default="", max_length=2000)


class ChecklistItemOut(ORM):
    id: int
    question: str
    position: int


class ChecklistIn(BaseModel):
    items: list[str] = Field(min_length=1, max_length=50)


class AssetPhotoOut(ORM):
    id: int
    url: str
    created_at: UTCDatetime


class AssetSummary(ORM):
    id: int
    code: str
    name: str
    category: str
    location: str
    owner_name: str
    status: AssetStatus
    qr_token: str
    report_token: str
    created_at: UTCDatetime
    open_issues: int = 0
    last_inspection_at: UTCDatetime | None = None
    last_inspection_passed: bool | None = None
    cover_url: str | None = None


class IssueOut(ORM):
    id: int
    asset_id: int
    title: str
    description: str
    severity: Severity
    status: str
    reported_by: str
    photo_url: str | None
    created_at: UTCDatetime
    resolved_at: UTCDatetime | None


class IssueWithAsset(IssueOut):
    asset_code: str
    asset_name: str


class AssetDetail(AssetSummary):
    photos: list[AssetPhotoOut]
    checklist: list[ChecklistItemOut]
    issues: list[IssueOut]
    inspection_count: int


class AnswerOut(ORM):
    question: str
    ok: bool
    note: str


class InspectionOut(ORM):
    id: int
    inspector_name: str
    passed: bool
    notes: str
    photo_url: str | None
    created_at: UTCDatetime
    answers: list[AnswerOut]


class EventOut(ORM):
    id: int
    asset_id: int
    kind: str
    level: str
    title: str
    detail: str
    actor: str
    photo_url: str | None
    created_at: UTCDatetime


class EventWithAsset(EventOut):
    asset_code: str
    asset_name: str


class MaintenanceIn(BaseModel):
    kind: Literal["preventive", "corrective"] = "corrective"
    description: str = Field(min_length=1, max_length=4000)
    performed_by: str = Field(min_length=1, max_length=120)
    resolve_issue_ids: list[int] = []


class DashboardOut(BaseModel):
    total_assets: int
    by_status: dict[str, int]
    open_issues: int
    inspections_today: int
    inspections_7d: int
    failed_7d: int
    attention_assets: list[AssetSummary]
    recent_events: list[EventWithAsset]


# ---- public (QR scan) ----

class PublicAsset(BaseModel):
    code: str
    name: str
    category: str
    location: str
    status: AssetStatus
    organization_name: str
    photos: list[str]
    checklist: list[ChecklistItemOut]
    open_issues: int
    last_inspection_at: UTCDatetime | None


class AnswerIn(BaseModel):
    item_id: int
    ok: bool
    note: str = Field(default="", max_length=500)


class InspectionIn(BaseModel):
    inspector_name: str = Field(min_length=1, max_length=120)
    answers: list[AnswerIn] = Field(min_length=1)
    notes: str = Field(default="", max_length=4000)


class MaintenanceOut(ORM):
    id: int
    kind: str
    description: str
    performed_by: str
    created_at: UTCDatetime


class ReportStats(BaseModel):
    total_checks: int
    failed_checks: int
    pass_rate: float | None  # 0..1, None when there are no checks
    open_issues: int
    resolved_issues: int
    maintenance_count: int
    last_check_at: UTCDatetime | None
    last_maintenance_at: UTCDatetime | None


class AssetReport(BaseModel):
    """Read-only full history of one asset, opened from its report QR code."""

    organization_name: str
    code: str
    name: str
    category: str
    location: str
    owner_name: str
    status: AssetStatus
    registered_at: UTCDatetime
    generated_at: UTCDatetime
    photos: list[str]
    stats: ReportStats
    checklist: list[ChecklistItemOut]
    issues: list[IssueOut]
    maintenance: list[MaintenanceOut]
    inspections: list[InspectionOut]
    events: list[EventOut]


class PublicResult(BaseModel):
    ok: bool
    message: str
    asset_status: AssetStatus
