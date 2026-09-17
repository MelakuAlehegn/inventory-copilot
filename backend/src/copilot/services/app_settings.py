"""Runtime app settings: the operator-controlled active LLM, stored in one DB row.

The active provider/model can be changed from the UI at runtime, so it must survive a
restart; it lives in a single ``app_settings`` row. When that row is absent (a fresh
install), we fall back to the env defaults in ``settings`` (LLM_PROVIDER / LLM_MODEL).
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from copilot.config import settings
from copilot.db.models import AppSetting

# The settings table holds exactly one row, pinned to this id by a DB check constraint.
_SINGLETON_ID = 1


@dataclass(frozen=True)
class LlmSettings:
    """The active LLM the assistant should use."""

    provider: str
    model: str


async def get_active_llm(session: AsyncSession) -> LlmSettings:
    """Return the active provider/model: the stored row, or env defaults when unset."""
    row = await session.get(AppSetting, _SINGLETON_ID)
    if row is None:
        return LlmSettings(provider=settings.llm_provider, model=settings.llm_model)
    return LlmSettings(provider=row.llm_provider, model=row.llm_model)


async def set_active_llm(session: AsyncSession, provider: str, model: str) -> LlmSettings:
    """Create or update the singleton row with a new provider/model and return it."""
    row = await session.get(AppSetting, _SINGLETON_ID)
    if row is None:
        session.add(AppSetting(id=_SINGLETON_ID, llm_provider=provider, llm_model=model))
    else:
        row.llm_provider = provider
        row.llm_model = model
    await session.commit()
    return LlmSettings(provider=provider, model=model)
