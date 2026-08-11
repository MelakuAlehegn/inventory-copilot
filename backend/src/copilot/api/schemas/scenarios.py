"""Schemas for saved-scenario CRUD."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from copilot.api.schemas.decisions import ScenarioRequest


class ScenarioCreate(BaseModel):
    name: str
    params: ScenarioRequest  # the what-if knob values, validated on save


class ScenarioUpdate(BaseModel):
    name: str | None = None
    params: ScenarioRequest | None = None


class SavedScenarioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    params: dict
    created_at: datetime
    updated_at: datetime
