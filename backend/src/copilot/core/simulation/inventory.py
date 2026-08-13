"""Per-series inventory positions: grounded policy recommendations + a simulated position.

M5 has no live inventory, only sales — so "current stock" here is a *simulated* position:
each series' on-hand at the end of the holdout, from replaying the policy. The
recommendations (reorder point, safety stock, order-up-to, order qty) are real policy math.
Everything is clearly derived, nothing invented.

Definitions (documented so they can be tuned):
  mean_daily      = mean_ltd / protection            (avg daily demand over the window)
  reorder_point   = mean_daily * lead_time + safety_stock   (cover lead-time demand + buffer)
  current_stock   = simulated on-hand at the last holdout day
  order_qty       = max(0, order_up_to - current_stock)
  days_to_stockout = current_stock / mean_daily
  status (risk-based — fits a periodic-review order-up-to policy better than a
  continuous-review reorder point, which flags nearly everything):
    critical  -> out of stock, or would run out within the lead time
    reorder   -> dipped below the safety-stock buffer (genuinely low)
    overstock -> above the order-up-to level
    healthy   -> otherwise
"""

from __future__ import annotations

from datetime import date

import polars as pl

from copilot.core.policy.base_stock import PolicyParams, order_up_to_levels
from copilot.core.simulation.engine import simulate


def inventory_table(
    forecast: pl.LazyFrame,
    history: pl.LazyFrame,
    actuals: pl.DataFrame,
    prices: pl.DataFrame,
    cutoff: date,
    params: PolicyParams = PolicyParams(),
) -> pl.DataFrame:
    """One row per series: recommendations, simulated position, status."""
    levels = order_up_to_levels(forecast, cutoff, params).collect()
    trajectory = simulate(levels, actuals, params)

    # Current position = average on-hand over the last review cycle (a representative recent
    # level, not one low point in the sawtooth).
    last_day = trajectory["day"].max()
    window_start = max(0, last_day - params.review_period + 1)
    current = (
        trajectory.filter(pl.col("day") >= window_start)
        .group_by("unique_id")
        .agg(pl.col("on_hand_end").mean().alias("current_stock"))
    )
    ids = history.select("unique_id", "item_id", "store_id").unique().collect()

    protection = params.protection
    return (
        levels.join(current, on="unique_id")
        .join(ids, on="unique_id")
        .join(prices, on="unique_id", how="left")
        .with_columns(mean_daily_demand=(pl.col("mean_ltd") / protection))
        .with_columns(
            reorder_point=(pl.col("mean_daily_demand") * params.lead_time + pl.col("safety_stock")),
            recommended_order_qty=pl.max_horizontal(
                pl.lit(0.0), pl.col("order_up_to") - pl.col("current_stock")
            ),
            days_until_stockout=pl.when(pl.col("mean_daily_demand") > 0)
            .then(pl.col("current_stock") / pl.col("mean_daily_demand"))
            .otherwise(None),
        )
        .with_columns(
            status=pl.when(pl.col("current_stock") <= 0)
            .then(pl.lit("critical"))
            .when(pl.col("days_until_stockout") <= params.lead_time)
            .then(pl.lit("critical"))
            .when(pl.col("current_stock") < pl.col("safety_stock"))
            .then(pl.lit("reorder"))
            .when(pl.col("current_stock") > pl.col("order_up_to"))
            .then(pl.lit("overstock"))
            .otherwise(pl.lit("healthy"))
        )
        .select(
            "unique_id",
            "item_id",
            "store_id",
            pl.col("current_stock").round(2),
            pl.col("reorder_point").round(2),
            pl.col("safety_stock").round(2),
            pl.col("order_up_to").round(2),
            pl.col("recommended_order_qty").round(2),
            pl.col("mean_daily_demand").round(3),
            pl.col("days_until_stockout").round(1),
            "status",
            pl.col("unit_price").round(2),
        )
        .sort("unique_id")
    )
