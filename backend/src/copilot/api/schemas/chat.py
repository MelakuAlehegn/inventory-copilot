"""Schemas for the chat endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChatRequest(BaseModel):
    message: str
    session_id: uuid.UUID | None = None  # omit to start a new conversation
    # What the user is currently viewing (e.g. {"page": "inventory", "item": "FOODS_3_090_CA_3"})
    # so the copilot can resolve "this item". Optional.
    context: dict | None = None


class ChatSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str | None
    page: str | None
    created_at: datetime


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    tool_calls: dict | None
    created_at: datetime
