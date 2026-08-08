"""Current-user endpoint — confirms the token and returns the caller's identity."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from copilot.api.security import get_current_user
from copilot.db.models import User

router = APIRouter(tags=["users"])


@router.get("/me")
async def me(user: User = Depends(get_current_user)) -> dict:
    return {"id": user.id, "email": user.email}
