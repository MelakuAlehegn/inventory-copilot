"""Operator settings: view and switch the active LLM, and pull Ollama models.

The active model is app-wide (one shared choice), so these endpoints change it for everyone.
Switching writes the DB row (so it survives restarts) and updates the live agent in place.
Any authenticated user may call these for now; an admin gate can be added later.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from copilot.api.dependencies import current_llm, set_current_llm
from copilot.api.schemas.settings import (
    LlmSettingsResponse,
    LlmStatusResponse,
    OllamaModel,
    PullModelRequest,
    UpdateLlmRequest,
)
from copilot.api.security import get_current_user
from copilot.config import settings
from copilot.db.models import User
from copilot.db.session import get_session
from copilot.services import ollama
from copilot.services.app_settings import LlmSettings, set_active_llm

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/llm", response_model=LlmStatusResponse)
async def get_llm_status(user: User = Depends(get_current_user)) -> LlmStatusResponse:
    """Current active model plus what the UI needs: available providers and Ollama state."""
    active = current_llm()
    ollama_available = await ollama.is_available(settings.ollama_base_url)
    models = await ollama.list_models(settings.ollama_base_url) if ollama_available else []
    return LlmStatusResponse(
        provider=active.provider,
        model=active.model,
        providers=["gemini", "ollama"],
        gemini_configured=bool(settings.google_api_key),
        ollama_available=ollama_available,
        ollama_models=[OllamaModel(**m) for m in models],
    )


@router.put("/llm", response_model=LlmSettingsResponse)
async def update_llm(
    body: UpdateLlmRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LlmSettingsResponse:
    """Switch the active model: persist it, then swap the live agent so it takes effect now."""
    saved = await set_active_llm(session, body.provider, body.model)
    set_current_llm(LlmSettings(provider=saved.provider, model=saved.model))
    return LlmSettingsResponse(provider=saved.provider, model=saved.model)


@router.post("/llm/pull")
async def pull_ollama_model(
    body: PullModelRequest,
    user: User = Depends(get_current_user),
) -> EventSourceResponse:
    """Download a model into Ollama, streaming progress to the UI over SSE."""

    async def _stream() -> AsyncIterator[dict[str, str]]:
        async for update in ollama.pull_model(settings.ollama_base_url, body.name):
            if "error" in update:
                yield {"event": "error", "data": json.dumps(update)}
                return
            yield {"event": "progress", "data": json.dumps(update)}
        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(_stream())
