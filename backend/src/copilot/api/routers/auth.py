"""Email/password auth: self-service registration and credential verification.

These are the only write endpoints that are intentionally PUBLIC (you can't hold a token
before you log in). The frontend's Auth.js Credentials provider calls `/auth/login`; the
sign-up form calls `/auth/register`. Google users never touch these — they're upserted from
the verified token elsewhere.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from copilot.api.schemas.auth import AuthUserResponse, LoginRequest, RegisterRequest
from copilot.api.security import hash_password, verify_password
from copilot.db.models import User
from copilot.db.session import get_session

router = APIRouter(prefix="/auth", tags=["auth"])


async def _user_by_email(session: AsyncSession, email: str) -> User | None:
    return (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()


@router.post("/register", response_model=AuthUserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)) -> User:
    """Create an email/password user."""
    if await _user_by_email(session, body.email) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "email already registered")
    user = User(
        id=f"credentials:{uuid.uuid4().hex}",
        email=body.email,
        name=body.name,
        password_hash=hash_password(body.password),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@router.post("/login", response_model=AuthUserResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)) -> User:
    """Verify email/password and return the identity (for Auth.js to build the session)."""
    user = await _user_by_email(session, body.email)
    if (
        user is None
        or user.password_hash is None
        or not verify_password(body.password, user.password_hash)
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid email or password")
    return user
