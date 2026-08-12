"""Schemas for email/password auth (register + login)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthUserResponse(BaseModel):
    """Identity returned to the frontend's Auth.js Credentials provider."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str | None
    name: str | None
