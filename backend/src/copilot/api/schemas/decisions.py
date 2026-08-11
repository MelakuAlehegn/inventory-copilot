"""Schemas for the decision endpoints (deterministic core over HTTP)."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class ScenarioRequest(BaseModel):
    """The what-if knobs (mirrors the core Scenario's user-facing fields)."""

    policy: str = "base_stock"
    lead_time: int = 7
    review_period: int = 7
    service_level: float = 0.95
    demand_multiplier: float = 1.0
    price_multiplier: float = 1.0
    elasticity: float = 0.0
    shock_start: date | None = None
    shock_end: date | None = None


class MetricsResponse(BaseModel):
    fill_rate: float
    stockout_units: float
    stockout_day_rate: float
    avg_on_hand: float
    holding_cost: float
    stockout_cost: float
    ordering_cost: float
    total_cost: float


class CompareRequest(BaseModel):
    lead_time: int = 7
    review_period: int = 7
    service_level: float = 0.95


class CompareResponse(BaseModel):
    base_stock: MetricsResponse
    naive: MetricsResponse
    delta: dict[str, float]  # base_stock minus naive, per metric


class ParetoRow(BaseModel):
    service_level: float
    policy: str
    fill_rate: float
    stockout_units: float
    stockout_day_rate: float
    avg_on_hand: float
    holding_cost: float
    stockout_cost: float
    ordering_cost: float
    total_cost: float


class ForecastScore(BaseModel):
    wrmsse_model: float
    wrmsse_naive: float
    wrmsse_improvement: float
    mean_rmsse_model: float
    pinball_mean: float
    n_series: int


class DecisionScore(BaseModel):
    service_level: float
    fill_rate_model: float
    fill_rate_naive: float
    stockout_day_rate_model: float
    stockout_day_rate_naive: float
    stockout_units_reduction: float
    holding_cost_reduction: float
    stockout_cost_reduction: float
    total_cost_reduction: float


class ScorecardResponse(BaseModel):
    forecast: ForecastScore
    decision: DecisionScore
