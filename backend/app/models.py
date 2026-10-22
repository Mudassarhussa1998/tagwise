import secrets
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def new_qr_token() -> str:
    return secrets.token_urlsafe(12)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    users: Mapped[list["User"]] = relationship(back_populates="organization")


class User(Base):
    """A dashboard user. Identity and sign-in live in Clerk; this row links a Clerk user to an organization."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    clerk_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[str] = mapped_column(String(20), default="admin")  # admin | member
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    organization: Mapped[Organization] = relationship(back_populates="users")


class Invite(Base):
    """Pending access for an email. Claimed automatically when that (verified) email first signs in."""

    __tablename__ = "invites"
    __table_args__ = (UniqueConstraint("org_id", "email"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[str] = mapped_column(String(20), default="member")
    invited_by: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (UniqueConstraint("org_id", "code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    code: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(80), default="")
    location: Mapped[str] = mapped_column(String(160), default="")
    owner_name: Mapped[str] = mapped_column(String(120), default="")
    # operational | attention | out_of_service
    status: Mapped[str] = mapped_column(String(20), default="operational")
    qr_token: Mapped[str] = mapped_column(String(40), unique=True, index=True, default=new_qr_token)
    # Separate key for the read-only report QR, so it can be shared or reset without touching check labels.
    report_token: Mapped[str] = mapped_column(String(40), unique=True, index=True, default=new_qr_token)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    checklist: Mapped[list["ChecklistItem"]] = relationship(
        back_populates="asset", cascade="all, delete-orphan", order_by="ChecklistItem.position"
    )
    inspections: Mapped[list["Inspection"]] = relationship(back_populates="asset", cascade="all, delete-orphan")
    issues: Mapped[list["Issue"]] = relationship(back_populates="asset", cascade="all, delete-orphan")
    maintenance: Mapped[list["Maintenance"]] = relationship(back_populates="asset", cascade="all, delete-orphan")
    events: Mapped[list["Event"]] = relationship(back_populates="asset", cascade="all, delete-orphan")
    photos: Mapped[list["AssetPhoto"]] = relationship(
        back_populates="asset", cascade="all, delete-orphan", order_by="AssetPhoto.id"
    )


class AssetPhoto(Base):
    """Pictures of the asset itself. The first one is the cover shown on lists and QR pages."""

    __tablename__ = "asset_photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    asset: Mapped[Asset] = relationship(back_populates="photos")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    question: Mapped[str] = mapped_column(String(255))
    position: Mapped[int] = mapped_column(Integer, default=0)

    asset: Mapped[Asset] = relationship(back_populates="checklist")


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    inspector_name: Mapped[str] = mapped_column(String(120))
    passed: Mapped[bool] = mapped_column(Boolean)
    notes: Mapped[str] = mapped_column(Text, default="")
    photo_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    asset: Mapped[Asset] = relationship(back_populates="inspections")
    answers: Mapped[list["InspectionAnswer"]] = relationship(
        back_populates="inspection", cascade="all, delete-orphan"
    )


class InspectionAnswer(Base):
    __tablename__ = "inspection_answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    inspection_id: Mapped[int] = mapped_column(ForeignKey("inspections.id"), index=True)
    question: Mapped[str] = mapped_column(String(255))
    ok: Mapped[bool] = mapped_column(Boolean)
    note: Mapped[str] = mapped_column(String(500), default="")

    inspection: Mapped[Inspection] = relationship(back_populates="answers")


class Issue(Base):
    __tablename__ = "issues"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    inspection_id: Mapped[int | None] = mapped_column(ForeignKey("inspections.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(10), default="medium")  # low | medium | high
    status: Mapped[str] = mapped_column(String(10), default="open")  # open | resolved
    reported_by: Mapped[str] = mapped_column(String(120))
    photo_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    asset: Mapped[Asset] = relationship(back_populates="issues")


class Maintenance(Base):
    __tablename__ = "maintenance"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="corrective")  # preventive | corrective
    description: Mapped[str] = mapped_column(Text)
    performed_by: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    asset: Mapped[Asset] = relationship(back_populates="maintenance")


class Event(Base):
    """Append-only timeline entry: the asset's digital health record."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    # registered | inspection | issue | maintenance | status
    kind: Mapped[str] = mapped_column(String(20))
    level: Mapped[str] = mapped_column(String(10), default="info")  # ok | warn | danger | info
    title: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str] = mapped_column(Text, default="")
    actor: Mapped[str] = mapped_column(String(120), default="")
    photo_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    asset: Mapped[Asset] = relationship(back_populates="events")
