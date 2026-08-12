"""Decision endpoints: the deterministic core over plain HTTP (no LLM).

These wrap the tested core functions so the dashboards and scenario builder can call them
directly. The computations are CPU-bound (simulations over ~14k series), so each runs in a
threadpool to keep the event loop free. The data is global/read-only, so these endpoints
are not user-scoped.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool

from copilot.agent.context import CopilotContext
from copilot.api.dependencies import get_context
from copilot.api.security import get_current_user
from copilot.api.schemas.decisions import (
    CompareRequest,
    CompareResponse,
    DecisionScore,
    ForecastScore,
    MetricsResponse,
    ParetoRow,
    ScenarioRequest,
    ScorecardResponse,
)
from copilot.core.simulation.pareto import service_cost_curve
from copilot.core.simulation.scenario import Scenario, run_scenario
from copilot.eval.decision import decision_report
from copilot.eval.forecast import evaluate_forecast

# Internal tool: every decision endpoint requires a valid token (data is global, so we
# gate for access, not per-user ownership).
router = APIRouter(prefix="/decisions", tags=["decisions"], dependencies=[Depends(get_current_user)])


def _run_scenario(ctx: CopilotContext, scenario: Scenario) -> dict:
    return run_scenario(
        scenario, ctx.actuals, ctx.prices, ctx.cutoff, forecast=ctx.forecast, history=ctx.history
    )


@router.post("/what-if", response_model=MetricsResponse)
async def what_if(body: ScenarioRequest, ctx: CopilotContext = Depends(get_context)):
    """Run one what-if scenario and return its service and cost metrics."""
    scenario = Scenario(**body.model_dump())
    metrics = await run_in_threadpool(_run_scenario, ctx, scenario)
    return MetricsResponse(**metrics)


@router.post("/compare", response_model=CompareResponse)
async def compare(body: CompareRequest, ctx: CopilotContext = Depends(get_context)):
    """Compare the forecast-driven policy against naive at one setting."""
    settings = body.model_dump()
    base = await run_in_threadpool(_run_scenario, ctx, Scenario(policy="base_stock", **settings))
    naive = await run_in_threadpool(_run_scenario, ctx, Scenario(policy="naive", **settings))
    delta = {k: round(base[k] - naive[k], 4) for k in base}
    return CompareResponse(
        base_stock=MetricsResponse(**base), naive=MetricsResponse(**naive), delta=delta
    )


@router.get("/pareto", response_model=list[ParetoRow])
async def pareto(
    service_levels: list[float] = Query(default=[0.90, 0.95, 0.98, 0.99]),
    ctx: CopilotContext = Depends(get_context),
):
    """The service-vs-cost trade-off curve for both policies across service levels."""
    curve = await run_in_threadpool(
        service_cost_curve, ctx.forecast, ctx.history, ctx.actuals, ctx.prices, ctx.cutoff, service_levels
    )
    return curve.to_dicts()


@router.get("/scorecard", response_model=ScorecardResponse)
async def scorecard(ctx: CopilotContext = Depends(get_context)):
    """Headline accuracy (forecast) and decision-quality (policy vs naive) numbers."""
    forecast = await run_in_threadpool(
        evaluate_forecast, ctx.history, ctx.forecast, ctx.actuals.lazy(), ctx.cutoff
    )
    decision, _curve = await run_in_threadpool(
        decision_report, ctx.forecast, ctx.history, ctx.actuals, ctx.prices, ctx.cutoff
    )
    return ScorecardResponse(
        forecast=ForecastScore(**forecast), decision=DecisionScore(**decision)
    )
