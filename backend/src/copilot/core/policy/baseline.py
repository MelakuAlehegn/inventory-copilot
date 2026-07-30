"""Naive baseline policy: same base-stock math, demand estimated from recent history.

This is the fair opponent for the forecast-driven policy — not a strawman. It uses the
identical order-up-to formula and the same service-level target; the only difference is
that mean and std of demand come from a trailing window of *actual* sales instead of the
ML quantile forecast. Comparing the two in simulation therefore isolates one thing: the
value the forecast adds.

    mean_LTD = mean_daily(last N days) * protection
    std_LTD  = std_daily(last N days)  * sqrt(protection)
    S        = mean_LTD + z(service_level) * std_LTD
"""

from __future__ import annotations

from datetime import date, timedelta

import polars as pl
from scipy.stats import norm

from copilot.core.policy.base_stock import PolicyParams


def naive_order_up_to_levels(
    history: pl.LazyFrame,
    cutoff: date,
    params: PolicyParams = PolicyParams(),
    lookback: int = 28,
) -> pl.LazyFrame:
    """Per-series (mean_ltd, safety_stock, order_up_to) from the last ``lookback`` days.

    Args:
        history: actual sales (unique_id, ds, y) up to and including cutoff.
        cutoff: forecast origin ("today").
        params: lead time, review period, service level (shared with base-stock).
        lookback: trailing window used to estimate demand mean/std.
    """
    start = cutoff - timedelta(days=lookback - 1)
    z = float(norm.ppf(params.service_level))
    protection = params.protection

    window = history.filter((pl.col("ds") >= start) & (pl.col("ds") <= cutoff))
    agg = window.group_by("unique_id").agg(
        mean_daily=pl.col("y").mean(),
        std_daily=pl.col("y").std().fill_null(0.0),
    )
    return agg.with_columns(
        mean_ltd=(pl.col("mean_daily") * protection),
        std_ltd=(pl.col("std_daily") * (protection**0.5)),
    ).with_columns(
        safety_stock=(z * pl.col("std_ltd")),
        order_up_to=(pl.col("mean_ltd") + z * pl.col("std_ltd")),
    )
