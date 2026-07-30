"""Turn a simulation trajectory into service and cost metrics.

Headline metrics (the "decision quality" story):
  fill_rate         - fraction of demanded units actually sold (service achieved).
  stockout_day_rate - fraction of series-days that ran short.
  holding_cost      - carrying cost of on-hand stock (rate x unit value x units held).
  stockout_cost     - lost-sale penalty (penalty x unit price x lost units).
  ordering_cost     - fixed cost per order placed.
  total_cost        - holding + stockout + ordering.

Costs are value-weighted (via each series' unit price) so expensive items count more,
consistent with how WRMSSE weighted series by revenue.
"""

from __future__ import annotations

import polars as pl

from copilot.core.policy.base_stock import PolicyParams


def summarize(
    trajectory: pl.DataFrame, prices: pl.DataFrame, params: PolicyParams = PolicyParams()
) -> dict[str, float]:
    """Aggregate a per-(series, day) trajectory into service + cost metrics.

    Args:
        trajectory: output of ``simulate`` (demand, sales, lost, on_hand_end, order_placed).
        prices: unique_id + unit_price (per-series unit value for cost weighting).
        params: economics (holding_rate, order_cost, stockout_penalty).
    """
    t = trajectory.join(prices, on="unique_id", how="left").with_columns(
        pl.col("unit_price").fill_null(pl.col("unit_price").median())
    )
    row = t.select(
        demand=pl.col("demand").sum(),
        sales=pl.col("sales").sum(),
        lost=pl.col("lost").sum(),
        on_hand_units=pl.col("on_hand_end").sum(),
        holding_cost=(pl.col("on_hand_end") * pl.col("unit_price") * params.holding_rate).sum(),
        stockout_cost=(pl.col("lost") * pl.col("unit_price") * params.stockout_penalty).sum(),
        n_orders=(pl.col("order_placed") > 0).sum(),
        stockout_days=(pl.col("lost") > 0).sum(),
        rows=pl.len(),
    ).to_dicts()[0]

    ordering_cost = row["n_orders"] * params.order_cost
    total_cost = row["holding_cost"] + row["stockout_cost"] + ordering_cost
    return {
        "fill_rate": row["sales"] / row["demand"],
        "stockout_units": float(row["lost"]),
        "stockout_day_rate": row["stockout_days"] / row["rows"],
        "avg_on_hand": row["on_hand_units"] / row["rows"],
        "holding_cost": float(row["holding_cost"]),
        "stockout_cost": float(row["stockout_cost"]),
        "ordering_cost": float(ordering_cost),
        "total_cost": float(total_cost),
    }
