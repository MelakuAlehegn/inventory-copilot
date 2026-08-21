"""Saved-scenario CRUD — a user's named what-if scenarios, scoped to their account."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from copilot.api.schemas.scenarios import (
    SavedScenarioResponse,
    ScenarioCreate,
    ScenarioUpdate,
)
from copilot.api.security import get_current_user
from copilot.db.models import SavedScenario, User
from copilot.db.session import get_session

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


async def _get_owned(session: AsyncSession, scenario_id: uuid.UUID, user: User) -> SavedScenario:
    """Fetch a scenario the caller owns, else 404 (so existence isn't leaked)."""
    scenario = await session.get(SavedScenario, scenario_id)
    if scenario is None or scenario.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "scenario not found")
    return scenario


@router.post("", response_model=SavedScenarioResponse, status_code=status.HTTP_201_CREATED)
async def create_scenario(
    body: ScenarioCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SavedScenario:
    scenario = SavedScenario(
        user_id=user.id, name=body.name, params=body.params.model_dump(mode="json")
    )
    session.add(scenario)
    await session.commit()
    await session.refresh(scenario)
    return scenario


@router.get("", response_model=list[SavedScenarioResponse])
async def list_scenarios(
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
) -> Sequence[SavedScenario]:
    rows = (
        (
            await session.execute(
                select(SavedScenario)
                .where(SavedScenario.user_id == user.id)
                .order_by(SavedScenario.updated_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return rows


@router.get("/{scenario_id}", response_model=SavedScenarioResponse)
async def get_scenario(
    scenario_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SavedScenario:
    return await _get_owned(session, scenario_id, user)


@router.patch("/{scenario_id}", response_model=SavedScenarioResponse)
async def update_scenario(
    scenario_id: uuid.UUID,
    body: ScenarioUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SavedScenario:
    scenario = await _get_owned(session, scenario_id, user)
    if body.name is not None:
        scenario.name = body.name
    if body.params is not None:
        scenario.params = body.params.model_dump(mode="json")
    await session.commit()
    await session.refresh(scenario)
    return scenario


@router.delete("/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scenario(
    scenario_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    scenario = await _get_owned(session, scenario_id, user)
    await session.delete(scenario)
    await session.commit()
