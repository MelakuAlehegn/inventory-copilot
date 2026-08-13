"""Shared providers with process-lifetime memoization.

The dataset and default-parameter results are static, so every heavy computation
(context load, inventory table, forecast/decision evaluation, Pareto, KPIs) is computed
ONCE and reused for the life of the process. `warm_caches()` precomputes them at startup so
the first page load doesn't trigger a burst of simulations. A restart clears the cache
(pick up code changes; recompute after a data rebuild).
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Callable

import polars as pl

from copilot.agent.context import CopilotContext, load_context
from copilot.agent.graph import build_agent
from copilot.core.data import analytics
from copilot.core.policy.base_stock import PolicyParams
from copilot.core.simulation.inventory import inventory_table
from copilot.core.simulation.scenario import Scenario, run_scenario
from copilot.eval.decision import decision_report
from copilot.eval.forecast import evaluate_forecast

logger = logging.getLogger("copilot.api")

DEFAULT_SERVICE_LEVELS = [0.90, 0.95, 0.98, 0.99]

_cache: dict[str, Any] = {}
_lock = threading.RLock()  # reentrant so memoized getters can call each other


def _memo(key: str, compute: Callable[[], Any]) -> Any:
    if key not in _cache:
        with _lock:
            if key not in _cache:
                _cache[key] = compute()
    return _cache[key]


def get_context() -> CopilotContext:
    return _memo("context", load_context)


def get_agent():
    return _memo("agent", lambda: build_agent(get_context()))


def get_inventory_table() -> pl.DataFrame:
    ctx = get_context()
    return _memo(
        "inventory",
        lambda: inventory_table(ctx.forecast, ctx.history, ctx.actuals, ctx.prices, ctx.cutoff),
    )


def get_forecast_summary() -> dict:
    ctx = get_context()
    return _memo(
        "forecast_summary",
        lambda: evaluate_forecast(ctx.history, ctx.forecast, ctx.actuals.lazy(), ctx.cutoff),
    )


def get_decision_report() -> tuple[dict, pl.DataFrame]:
    """(headline summary, full Pareto curve) at default service levels — computed once."""
    ctx = get_context()
    return _memo(
        "decision_report",
        lambda: decision_report(ctx.forecast, ctx.history, ctx.actuals, ctx.prices, ctx.cutoff),
    )


def get_scorecard() -> dict:
    return _memo(
        "scorecard",
        lambda: {"forecast": get_forecast_summary(), "decision": get_decision_report()[0]},
    )


def get_pareto_default() -> pl.DataFrame:
    return _memo("pareto", lambda: get_decision_report()[1])


def get_kpis() -> dict:
    return _memo("kpis", analytics.kpis)


def compare_metrics(ctx: CopilotContext, lead_time: int, review_period: int, service_level: float) -> dict:
    """base_stock vs naive at one setting (used by the endpoint and the default cache)."""
    common = dict(lead_time=lead_time, review_period=review_period, service_level=service_level)
    base = run_scenario(
        Scenario(policy="base_stock", **common), ctx.actuals, ctx.prices, ctx.cutoff,
        forecast=ctx.forecast, history=ctx.history,
    )
    naive = run_scenario(
        Scenario(policy="naive", **common), ctx.actuals, ctx.prices, ctx.cutoff,
        forecast=ctx.forecast, history=ctx.history,
    )
    delta = {k: round(base[k] - naive[k], 4) for k in base}
    return {"base_stock": base, "naive": naive, "delta": delta}


def get_compare_default() -> dict:
    ctx = get_context()
    p = PolicyParams()
    return _memo("compare", lambda: compare_metrics(ctx, p.lead_time, p.review_period, p.service_level))


def warm_caches() -> None:
    """Precompute the static caches sequentially (no request-time simulation burst)."""
    try:
        get_context()
        get_inventory_table()
        get_forecast_summary()
        get_decision_report()
        get_scorecard()
        get_pareto_default()
        get_kpis()
        get_compare_default()
        logger.info("caches warmed")
    except Exception:  # a warm failure must never crash the server
        logger.exception("cache warm-up failed (will compute lazily on first request)")
