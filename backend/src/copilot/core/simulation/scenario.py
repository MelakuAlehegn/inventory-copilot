"""What-if scenarios: adjustable knobs bundled into one simulation run.

A ``Scenario`` collects every lever we want to ask "what if?" about, and
``run_scenario`` turns it into a single metrics dict by driving the existing
policy -> simulate -> summarize chain. This is the unit the agent will call as a tool
("what if lead time doubles?", "what if demand runs 20% above forecast?").

Two kinds of lever, and the distinction matters:
  * *Planned* levers (lead_time, review_period, service_level) feed the policy, so the
    order-up-to level adapts to them — the business "sees them coming".
  * *Realized* levers (demand_multiplier, price_multiplier) change what actually
    happens after the plan is fixed. A demand_multiplier > 1 is therefore an
    *unanticipated* shock: the policy sized stock for the forecast, then reality came in
    hotter — exactly the stress test that reveals exposure.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import polars as pl

from copilot.core.policy.base_stock import PolicyParams, order_up_to_levels
from copilot.core.policy.baseline import naive_order_up_to_levels
from copilot.core.simulation.engine import simulate
from copilot.core.simulation.metrics import summarize


@dataclass(frozen=True)
class Scenario:
    """Adjustable what-if knobs for a single simulation run."""

    policy: str = "base_stock"  # "base_stock" (forecast-driven) or "naive" (history)

    # Planned levers — the policy sees these and adapts its order-up-to level.
    lead_time: int = 7  # days until an order arrives
    review_period: int = 7  # days between order reviews
    service_level: float = 0.95  # target in-stock probability per cycle

    # Realized levers — applied after the plan is fixed.
    demand_multiplier: float = 1.0  # scales actual demand (>1 = unanticipated shock)
    price_multiplier: float = 1.0  # scales unit price (cost sensitivity)

    def params(self) -> PolicyParams:
        """The PolicyParams the planned levers imply (economics left at defaults)."""
        return PolicyParams(
            lead_time=self.lead_time,
            review_period=self.review_period,
            service_level=self.service_level,
        )


def run_scenario(
    scenario: Scenario,
    actuals: pl.DataFrame,
    prices: pl.DataFrame,
    cutoff: date,
    *,
    forecast: pl.LazyFrame | None = None,
    history: pl.LazyFrame | None = None,
) -> dict[str, float]:
    """Run one what-if scenario end to end and return its metrics.

    Args:
        scenario: the knob settings.
        actuals: unique_id, ds, y — real demand over the horizon.
        prices: unique_id, unit_price — per-series unit value for costing.
        cutoff: forecast origin ("today").
        forecast: quantile forecast, required when ``scenario.policy == "base_stock"``.
        history: past sales, required when ``scenario.policy == "naive"``.
    """
    params = scenario.params()
    if scenario.policy == "base_stock":
        if forecast is None:
            raise ValueError("base_stock policy needs a forecast")
        levels = order_up_to_levels(forecast, cutoff, params)
    elif scenario.policy == "naive":
        if history is None:
            raise ValueError("naive policy needs history")
        levels = naive_order_up_to_levels(history, cutoff, params)
    else:
        raise ValueError(f"unknown policy: {scenario.policy!r}")

    shocked = actuals.with_columns((pl.col("y") * scenario.demand_multiplier).alias("y"))
    priced = prices.with_columns(
        (pl.col("unit_price") * scenario.price_multiplier).alias("unit_price")
    )
    trajectory = simulate(levels, shocked, params)
    return summarize(trajectory, priced, params)
