"""Schemas for the forecast endpoints."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class ForecastPoint(BaseModel):
    ds: date
    q50: float
    q80: float
    q90: float
    q95: float
    q99: float
    actual: float | None  # realized demand for this holdout day, if known


class ForecastSeriesResponse(BaseModel):
    unique_id: str
    cutoff: date  # forecast origin; points cover the horizon after it
    points: list[ForecastPoint]


class ForecastSummary(BaseModel):
    wrmsse_model: float
    wrmsse_naive: float
    wrmsse_improvement: float
    mean_rmsse_model: float
    pinball_mean: float
    n_series: int
