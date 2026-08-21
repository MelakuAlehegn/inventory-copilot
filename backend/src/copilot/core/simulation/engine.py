"""Periodic-review inventory simulation.

Replays actual demand day by day for every series against a policy's order-up-to
levels, returning the full per-day trajectory. Each day, in order:
  1. receive orders arriving today (placed lead_time days ago),
  2. meet demand from on-hand stock; anything unmet is a lost sale (no back-orders),
  3. on review days (every review_period), order back up to S based on the inventory
     position (on-hand + already on order); the order arrives lead_time days later.

The simulation starts each series full at its own S, so both policies get a fair,
identical starting condition relative to their target.
"""

from __future__ import annotations

import numpy as np
import polars as pl

from copilot.core.forecast.baseline import HORIZON
from copilot.core.policy.base_stock import PolicyParams


def _to_df(x: pl.LazyFrame | pl.DataFrame) -> pl.DataFrame:
    return x.collect() if isinstance(x, pl.LazyFrame) else x


def simulate(
    levels: pl.LazyFrame | pl.DataFrame,
    actuals: pl.LazyFrame | pl.DataFrame,
    params: PolicyParams = PolicyParams(),
    horizon: int = HORIZON,
) -> pl.DataFrame:
    """Simulate the horizon and return a per-(series, day) trajectory.

    Args:
        levels: unique_id + order_up_to (per-series target S).
        actuals: unique_id, ds, y — the real demand over the horizon.
        params: lead_time and review_period drive the mechanics.

    Returns:
        Long frame: unique_id, day, demand, received, sales, lost, on_hand_end,
        order_placed.
    """
    lv = _to_df(levels).select("unique_id", "order_up_to").sort("unique_id")
    wide = (
        _to_df(actuals).select("unique_id", "ds", "y").pivot(values="y", index="unique_id", on="ds")
    )
    merged = lv.join(wide, on="unique_id").sort("unique_id")

    day_cols = sorted(c for c in wide.columns if c != "unique_id")
    uids = merged["unique_id"].to_numpy()
    s_level = merged["order_up_to"].to_numpy().astype(float)
    demand = merged.select(day_cols).to_numpy().astype(float)
    n, h = demand.shape

    on_hand = s_level.copy()
    on_order = np.zeros(n)
    arrivals = np.zeros((n, h + params.lead_time + 1))

    received = np.zeros((n, h))
    sales = np.zeros((n, h))
    lost = np.zeros((n, h))
    on_hand_end = np.zeros((n, h))
    order_placed = np.zeros((n, h))

    for t in range(h):
        r = arrivals[:, t].copy()
        on_hand += r
        on_order -= r

        d = demand[:, t]
        s = np.minimum(on_hand, d)
        on_hand -= s

        received[:, t] = r
        sales[:, t] = s
        lost[:, t] = d - s

        if t % params.review_period == 0:
            order = np.maximum(0.0, s_level - (on_hand + on_order))
            arrivals[:, t + params.lead_time] += order
            on_order += order
            order_placed[:, t] = order

        on_hand_end[:, t] = on_hand

    return pl.DataFrame(
        {
            "unique_id": np.repeat(uids, h),
            "day": np.tile(np.arange(h), n),
            "demand": demand.reshape(-1),
            "received": received.reshape(-1),
            "sales": sales.reshape(-1),
            "lost": lost.reshape(-1),
            "on_hand_end": on_hand_end.reshape(-1),
            "order_placed": order_placed.reshape(-1),
        }
    )
