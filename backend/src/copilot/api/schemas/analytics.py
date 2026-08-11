"""Schemas for the analytics endpoints."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class KpisResponse(BaseModel):
    n_series: int
    n_stores: int
    start_date: date
    end_date: date
    total_units: float
    total_revenue: float
    avg_daily_demand: float


class TopSeriesRow(BaseModel):
    unique_id: str
    item_id: str
    store_id: str
    units: float
    revenue: float | None


class SeriesPoint(BaseModel):
    ds: date
    units: float
    revenue: float | None


class SeriesDetailResponse(BaseModel):
    unique_id: str
    item_id: str
    store_id: str
    n_days: int
    start_date: date
    end_date: date
    total_units: float
    total_revenue: float | None
    avg_price: float | None
    series: list[SeriesPoint]


class StoreRow(BaseModel):
    store_id: str
    n_series: int
    total_units: float
    total_revenue: float | None
