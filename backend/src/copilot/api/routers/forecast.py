"""Forecast endpoints: per-series quantile bands vs actuals, and an accuracy summary.

Serves the cached quantile forecast so the UI can draw the uncertainty fan against realized
demand, plus the headline accuracy (reusing the eval's WRMSSE/pinball). Global read-only
data, so gated for access (internal tool) but not user-scoped; CPU work runs in a threadpool.
"""

from __future__ import annotations

from typing import Any

import polars as pl
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from copilot.agent.context import CopilotContext
from copilot.api.dependencies import get_context, get_forecast_summary, get_series_options
from copilot.api.schemas.forecast import ForecastSeriesResponse, ForecastSummary, SeriesOptions
from copilot.api.security import get_current_user

router = APIRouter(prefix="/forecast", tags=["forecast"], dependencies=[Depends(get_current_user)])

_QCOLS = ["q50", "q80", "q90", "q95", "q99"]


def _series_points(ctx: CopilotContext, unique_id: str) -> list[dict[str, Any]] | None:
    """Quantiles joined to actuals for one series over the horizon; None if unknown."""
    fc = (
        ctx.forecast.filter(pl.col("unique_id") == unique_id)
        .select("ds", *_QCOLS)
        .sort("ds")
        .collect()
    )
    if fc.height == 0:
        return None
    actuals = ctx.actuals.filter(pl.col("unique_id") == unique_id).select(
        "ds", pl.col("y").alias("actual")
    )
    return fc.join(actuals, on="ds", how="left").to_dicts()


@router.get("/summary", response_model=ForecastSummary)
async def summary() -> ForecastSummary:
    """Headline forecast accuracy vs the seasonal-naive baseline (cached)."""
    scores = await run_in_threadpool(get_forecast_summary)
    return ForecastSummary(**scores)


@router.get("/options", response_model=SeriesOptions)
async def options() -> dict[str, Any]:
    """Distinct item and store ids for the series selector (cached)."""
    return await run_in_threadpool(get_series_options)


@router.get("/series/{unique_id}", response_model=ForecastSeriesResponse)
async def series(
    unique_id: str, ctx: CopilotContext = Depends(get_context)
) -> ForecastSeriesResponse:
    """Per-series quantile bands (q50..q99) with realized actuals over the horizon."""
    points = await run_in_threadpool(_series_points, ctx, unique_id)
    if points is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "series not found")
    return ForecastSeriesResponse(unique_id=unique_id, cutoff=ctx.cutoff, points=points)
