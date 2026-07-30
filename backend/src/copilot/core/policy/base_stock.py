"""Periodic-review order-up-to (base-stock) levels from a quantile forecast.

Each review we order back up to a level ``S`` that must cover demand over the
protection window = lead time + review period (the time until the *next* order can
arrive). Using the daily quantile forecast we estimate each day's mean and spread,
sum them over the window (assuming day-to-day independence), and set:

    S = mean_LTD + z(service_level) * std_LTD

where ``mean_LTD``/``std_LTD`` are the mean/std of demand over the window and ``z`` is
the normal quantile for the target service level. The ``z * std_LTD`` term is the
safety stock — the buffer that absorbs demand uncertainty.

The per-day spread is read from the forecast: std_day ~= (q90 - q50) / z(0.90),
i.e. how wide the 50->90 band is, converted to a standard deviation.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import polars as pl
from scipy.stats import norm

_Z90 = float(norm.ppf(0.90))  # ~1.2816, used to turn the q50->q90 gap into a std


@dataclass(frozen=True)
class PolicyParams:
    """Documented, user-adjustable inventory settings (synthesized, not from M5)."""

    lead_time: int = 7  # days until a placed order arrives
    review_period: int = 7  # days between order reviews
    service_level: float = 0.95  # target in-stock probability per cycle

    @property
    def protection(self) -> int:
        """Days of demand a base-stock level must cover: lead time + review period."""
        return self.lead_time + self.review_period


def order_up_to_levels(
    forecast: pl.LazyFrame, cutoff: date, params: PolicyParams = PolicyParams()
) -> pl.LazyFrame:
    """Compute per-series (mean_ltd, safety_stock, order_up_to) from quantile forecasts.

    Args:
        forecast: LazyFrame with unique_id, ds, q50, q90 over the horizon after cutoff.
        cutoff: forecast origin ("today"); the window is the next ``protection`` days.
        params: lead time, review period, service level.
    """
    window_end = cutoff + timedelta(days=params.protection)
    z = float(norm.ppf(params.service_level))

    window = forecast.filter((pl.col("ds") > cutoff) & (pl.col("ds") <= window_end))
    per_day = window.with_columns(
        mu=pl.col("q50"),
        sigma=((pl.col("q90") - pl.col("q50")) / _Z90).clip(lower_bound=0.0),
    )
    agg = per_day.group_by("unique_id").agg(
        mean_ltd=pl.col("mu").sum(),
        std_ltd=(pl.col("sigma") ** 2).sum().sqrt(),
    )
    return agg.with_columns(
        safety_stock=(z * pl.col("std_ltd")),
        order_up_to=(pl.col("mean_ltd") + z * pl.col("std_ltd")),
    )
