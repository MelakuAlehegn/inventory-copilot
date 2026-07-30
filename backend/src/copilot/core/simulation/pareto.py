"""Service-vs-cost sweep: run both policies across target service levels.

Sweeping the service level traces each policy's trade-off curve (higher target ->
more safety stock -> better service but more holding). Comparing the two curves shows
whether the forecast-driven policy dominates the naive one at *every* operating point,
rather than winning at a single cherry-picked service level.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import replace
from datetime import date

import polars as pl

from copilot.core.policy.base_stock import PolicyParams, order_up_to_levels
from copilot.core.policy.baseline import naive_order_up_to_levels
from copilot.core.simulation.engine import simulate
from copilot.core.simulation.metrics import summarize


def service_cost_curve(
    forecast: pl.LazyFrame,
    history: pl.LazyFrame,
    actuals: pl.DataFrame,
    prices: pl.DataFrame,
    cutoff: date,
    service_levels: Sequence[float],
    base: PolicyParams = PolicyParams(),
) -> pl.DataFrame:
    """One row per (service_level, policy) with the full metrics from ``summarize``."""
    rows: list[dict] = []
    for sl in service_levels:
        params = replace(base, service_level=sl)
        policies = {
            "base_stock": order_up_to_levels(forecast, cutoff, params),
            "naive": naive_order_up_to_levels(history, cutoff, params),
        }
        for name, levels in policies.items():
            metrics = summarize(simulate(levels, actuals, params), prices, params)
            rows.append({"service_level": sl, "policy": name, **metrics})
    return pl.DataFrame(rows)
