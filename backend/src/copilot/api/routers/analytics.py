"""Analytics endpoints: dashboard KPIs and drilldowns, backed by DuckDB over Parquet.

Read-only aggregations on global data, so (like the decision endpoints) these are not
user-scoped. Queries run in a threadpool since DuckDB calls are blocking.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool

from copilot.api.schemas.analytics import (
    KpisResponse,
    SeriesDetailResponse,
    StoreRow,
    TopSeriesRow,
)
from copilot.api.security import get_current_user
from copilot.core.data import analytics

# Internal tool: analytics require a valid token too.
router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(get_current_user)])


@router.get("/kpis", response_model=KpisResponse)
async def get_kpis():
    """Headline dataset KPIs (series/stores counts, date range, totals)."""
    return await run_in_threadpool(analytics.kpis)


@router.get("/top-series", response_model=list[TopSeriesRow])
async def get_top_series(
    metric: Literal["revenue", "units"] = "revenue",
    limit: int = Query(default=10, ge=1, le=100),
):
    """Top series (item x store) by revenue or units."""
    return await run_in_threadpool(analytics.top_series, metric, limit)


@router.get("/series/{unique_id}", response_model=SeriesDetailResponse)
async def get_series(unique_id: str):
    """Per-series drilldown: daily units/revenue time series + summary."""
    detail = await run_in_threadpool(analytics.series_detail, unique_id)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "series not found")
    return detail


@router.get("/stores", response_model=list[StoreRow])
async def get_stores():
    """Per-store totals."""
    return await run_in_threadpool(analytics.stores)
