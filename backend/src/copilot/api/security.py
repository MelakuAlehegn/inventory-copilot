"""Authentication: verify the frontend's Bearer JWT and resolve the current user.

The frontend signs a compact HS256 token (claims ``sub`` and ``email``) with a shared
secret; here we verify it, then upsert a light ``users`` row so the app tables have a
stable owner to key to. Endpoints depend on ``get_current_user`` to enforce per-user access.
"""

from __future__ import annotations

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from copilot.config import settings
from copilot.db.models import User
from copilot.db.session import get_session

_bearer = HTTPBearer(auto_error=True)


def hash_password(password: str) -> str:
    """bcrypt hash for storage."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plaintext password against a stored bcrypt hash."""
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def decode_token(token: str) -> dict:
    """Verify signature + expiry and return the claims. Raises 401 on any problem."""
    if not settings.auth_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="authentication is not configured",
        )
    try:
        return jwt.decode(token, settings.auth_jwt_secret, algorithms=[settings.auth_jwt_algorithm])
    except jwt.PyJWTError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid or expired token"
        ) from err


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Resolve (and lazily create) the user the Bearer token identifies."""
    claims = decode_token(credentials.credentials)
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="token missing subject"
        )
    email = claims.get("email")

    user = await session.get(User, sub)
    if user is None:
        user = User(id=sub, email=email)
        session.add(user)
        await session.commit()
    elif email and user.email != email:
        user.email = email
        await session.commit()
    return user
