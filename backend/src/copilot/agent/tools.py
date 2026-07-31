"""The inventory tools the agent may call.

``build_tools(ctx)`` returns LangChain tools bound to a loaded ``CopilotContext``. Each
tool exposes only the decisions the model gets to make; the heavy data (forecast,
actuals, prices, cutoff) is carried privately by the context. The tools do the real,
deterministic math by delegating to the tested core — the model never computes anything.
"""

from __future__ import annotations

from datetime import date

from langchain_core.tools import BaseTool, tool

from copilot.agent.context import CopilotContext
from copilot.core.simulation.pareto import service_cost_curve
from copilot.core.simulation.scenario import Scenario, run_scenario

# How many decimals to keep per metric when handing results to the model — tidy numbers,
# no float noise. (Grounding later tolerates rounding anyway.)
_PRECISION = {"fill_rate": 4, "stockout_day_rate": 4, "avg_on_hand": 2, "stockout_units": 1}


def _round(metrics: dict[str, float]) -> dict[str, float]:
    return {k: round(v, _PRECISION.get(k, 2)) for k, v in metrics.items()}


def _parse_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def build_tools(ctx: CopilotContext) -> list[BaseTool]:
    """Create the agent's tools, each bound to the given data context."""

    @tool(parse_docstring=True)
    def run_what_if(
        policy: str = "base_stock",
        lead_time: int = 7,
        review_period: int = 7,
        service_level: float = 0.95,
        demand_multiplier: float = 1.0,
        price_multiplier: float = 1.0,
        elasticity: float = 0.0,
        shock_start: str | None = None,
        shock_end: str | None = None,
    ) -> dict:
        """Run one inventory what-if scenario and return its service and cost metrics.

        Use this for any single "what happens if ..." question. Returns fill_rate,
        stockout_units, stockout_day_rate, avg_on_hand, holding_cost, stockout_cost,
        ordering_cost and total_cost over the holdout horizon.

        Args:
            policy: "base_stock" (forecast-driven) or "naive" (recent-average history).
            lead_time: days until a placed order arrives. Higher = the policy must buffer more.
            review_period: days between order reviews.
            service_level: target in-stock probability per cycle, 0-1 (e.g. 0.95).
            demand_multiplier: scales ACTUAL demand vs the plan. >1 is an unanticipated
                spike (e.g. 1.25 = demand runs 25% hotter than forecast); <1 is a slump.
            price_multiplier: scales unit price. Affects costs; also demand if elasticity is set.
            elasticity: price elasticity of demand (usually negative). With it set, a price
                change of (price_multiplier-1) changes demand by elasticity*(price_multiplier-1).
                Leave 0 for no price->demand link. This is an approximation.
            shock_start: optional ISO date "YYYY-MM-DD"; limits the demand shock to on/after this day.
            shock_end: optional ISO date "YYYY-MM-DD"; limits the demand shock to on/before this day.
        """
        scenario = Scenario(
            policy=policy,
            lead_time=lead_time,
            review_period=review_period,
            service_level=service_level,
            demand_multiplier=demand_multiplier,
            price_multiplier=price_multiplier,
            elasticity=elasticity,
            shock_start=_parse_date(shock_start),
            shock_end=_parse_date(shock_end),
        )
        metrics = run_scenario(
            scenario, ctx.actuals, ctx.prices, ctx.cutoff,
            forecast=ctx.forecast, history=ctx.history,
        )
        return _round(metrics)

    @tool(parse_docstring=True)
    def compare_policies(
        lead_time: int = 7, review_period: int = 7, service_level: float = 0.95
    ) -> dict:
        """Compare the forecast-driven policy against the naive baseline at one setting.

        Runs both policies over the holdout with identical settings and returns their
        metrics plus the difference (base_stock minus naive) for each metric.

        Args:
            lead_time: days until a placed order arrives.
            review_period: days between order reviews.
            service_level: target in-stock probability per cycle, 0-1.
        """
        common = dict(lead_time=lead_time, review_period=review_period, service_level=service_level)
        base = run_scenario(
            Scenario(policy="base_stock", **common), ctx.actuals, ctx.prices, ctx.cutoff,
            forecast=ctx.forecast, history=ctx.history,
        )
        naive = run_scenario(
            Scenario(policy="naive", **common), ctx.actuals, ctx.prices, ctx.cutoff,
            forecast=ctx.forecast, history=ctx.history,
        )
        delta = {k: round(base[k] - naive[k], _PRECISION.get(k, 2)) for k in base}
        return {"base_stock": _round(base), "naive": _round(naive), "delta_base_minus_naive": delta}

    @tool(parse_docstring=True)
    def get_pareto_curve(service_levels: list[float] | None = None) -> list[dict]:
        """Sweep service levels to trace the service-vs-cost trade-off for both policies.

        Returns one row per (service_level, policy) with fill_rate and the cost metrics,
        so you can see how each policy trades service for cost across operating points.

        Args:
            service_levels: list of targets 0-1 to evaluate. Defaults to
                [0.90, 0.95, 0.98, 0.99] if not given.
        """
        levels = service_levels or [0.90, 0.95, 0.98, 0.99]
        curve = service_cost_curve(
            ctx.forecast, ctx.history, ctx.actuals, ctx.prices, ctx.cutoff, levels
        )
        return [_round(row) for row in curve.to_dicts()]

    return [run_what_if, compare_policies, get_pareto_curve]
