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

    # Approximate price elasticity of demand: a price change of (price_multiplier - 1)
    # induces a demand change of elasticity * (price_multiplier - 1). 0.0 = no coupling
    # (price is cost-only). Typically negative: a discount (<1) lifts demand. This is a
    # deliberate simplification of a real demand curve — flag it when reporting.
    elasticity: float = 0.0

    # Optional window for the demand shock (e.g. a promo week). When both are None the
    # multiplier hits the whole horizon; otherwise it applies only inside [start, end].
    shock_start: date | None = None
    shock_end: date | None = None

    # Cost-structure dials — only touch how outcomes are *costed*, not the physical flow.
    holding_rate: float = PolicyParams.holding_rate  # daily holding cost as fraction of value
    order_cost: float = PolicyParams.order_cost  # fixed cost per order placed
    stockout_penalty: float = PolicyParams.stockout_penalty  # lost-unit cost x unit price

    def params(self) -> PolicyParams:
        """The PolicyParams these knobs imply (planned levers + cost structure)."""
        return PolicyParams(
            lead_time=self.lead_time,
            review_period=self.review_period,
            service_level=self.service_level,
            holding_rate=self.holding_rate,
            order_cost=self.order_cost,
            stockout_penalty=self.stockout_penalty,
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

    in_window: pl.Expr = pl.lit(True)
    if scenario.shock_start is not None:
        in_window = in_window & (pl.col("ds") >= scenario.shock_start)
    if scenario.shock_end is not None:
        in_window = in_window & (pl.col("ds") <= scenario.shock_end)

    # Combine the explicit demand shock with the price-induced demand change (elasticity),
    # clamped so demand never goes negative. Both apply over the shock window.
    price_demand_factor = 1.0 + scenario.elasticity * (scenario.price_multiplier - 1.0)
    combined_multiplier = scenario.demand_multiplier * max(price_demand_factor, 0.0)
    shocked = actuals.with_columns(
        pl.when(in_window)
        .then(pl.col("y") * combined_multiplier)
        .otherwise(pl.col("y"))
        .alias("y")
    )
    priced = prices.with_columns(
        (pl.col("unit_price") * scenario.price_multiplier).alias("unit_price")
    )
    trajectory = simulate(levels, shocked, params)
    return summarize(trajectory, priced, params)
