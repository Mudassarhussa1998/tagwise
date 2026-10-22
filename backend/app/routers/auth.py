from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Invite, Organization, User
from ..schemas import InviteIn, InviteOut, MeOut, OnboardIn, SessionOut, UserOut
from ..security import fetch_clerk_profile, get_clerk_user_id, get_current_user, require_admin

router = APIRouter(prefix="/api", tags=["auth"])


def me_out(user: User) -> MeOut:
    return MeOut(**UserOut.model_validate(user).model_dump(), organization_name=user.organization.name)


@router.get("/auth/session", response_model=SessionOut)
def session(clerk_id: str = Depends(get_clerk_user_id), db: Session = Depends(get_db)):
    """Who am I? Joins a pending invite on first sign-in; otherwise reports that onboarding is needed."""
    user = db.scalar(select(User).where(User.clerk_id == clerk_id))
    if user:
        return SessionOut(user=me_out(user), email=user.email)

    profile = fetch_clerk_profile(clerk_id)
    invite = db.scalar(select(Invite).where(Invite.email == profile.email).order_by(Invite.created_at)) if profile.email else None
    if invite is None:
        return SessionOut(user=None, email=profile.email)

    user = User(clerk_id=clerk_id, org_id=invite.org_id, name=profile.name, email=profile.email, role=invite.role)
    db.add(user)
    db.delete(invite)
    db.commit()
    return SessionOut(user=me_out(user), email=user.email)


@router.post("/auth/onboard", response_model=MeOut, status_code=201)
def onboard(body: OnboardIn, clerk_id: str = Depends(get_clerk_user_id), db: Session = Depends(get_db)):
    """Create a new organization with the signed-in Clerk user as its admin."""
    if db.scalar(select(User).where(User.clerk_id == clerk_id)):
        raise HTTPException(409, "You already belong to an organization")
    profile = fetch_clerk_profile(clerk_id)
    user = User(
        clerk_id=clerk_id,
        organization=Organization(name=body.organization.strip()),
        name=profile.name,
        email=profile.email,
        role="admin",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # double submit raced us
        db.rollback()
        raise HTTPException(409, "You already belong to an organization")
    return me_out(user)


@router.get("/users", response_model=list[UserOut])
def list_users(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(User).where(User.org_id == user.org_id).order_by(User.created_at)).all()


@router.get("/invites", response_model=list[InviteOut])
def list_invites(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Invite).where(Invite.org_id == user.org_id).order_by(Invite.created_at)).all()


@router.post("/invites", response_model=InviteOut, status_code=201)
def create_invite(body: InviteIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.org_id == admin.org_id, User.email == email)):
        raise HTTPException(409, "That person is already on your team")
    invite = Invite(org_id=admin.org_id, email=email, role=body.role, invited_by=admin.name)
    db.add(invite)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "That email has already been invited")
    return invite


@router.delete("/invites/{invite_id}", status_code=204)
def delete_invite(invite_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    invite = db.get(Invite, invite_id)
    if invite is None or invite.org_id != admin.org_id:
        raise HTTPException(404, "Invite not found")
    db.delete(invite)
    db.commit()
