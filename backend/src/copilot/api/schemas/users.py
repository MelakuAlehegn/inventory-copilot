"""Schemas for the user endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class MeResponse(BaseModel):
    id: str
    email: str | None = None
