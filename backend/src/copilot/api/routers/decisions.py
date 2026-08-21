"""Decision endpoints: the deterministic core over plain HTTP (no LLM).

Default-parameter results (scorecard, Pareto, default compare) are served from the
process cache (see dependencies.py), so the dashboard's repeated calls don't re-run
simulations. Non-default requests compute fresh in a threadpool. Global read-only data,
so gated for access but not user-scoped.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool

from copilot.agent.context import CopilotContext
from copilot.api.dependencies import (
    DEFAULT_SERVICE_LEVELS,
    compare_metrics,
    get_compare_default,
    get_context,
    get_pareto_default,
    get_scorecard,
)
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
from copilot.api.security import get_current_user
from copilot.core.simulation.pareto import service_cost_curve
from copilot.core.simulation.scenario import Scenario, run_scenario

router = APIRouter(
    prefix="/decisions", tags=["decisions"], dependencies=[Depends(get_current_user)]
)


@router.post("/what-if", response_model=MetricsResponse)
async def what_if(body: ScenarioRequest, ctx: CopilotContext = Depends(get_context)):
    """Run one what-if scenario and return its service and cost metrics."""
    scenario = Scenario(**body.model_dump())
    metrics = await run_in_threadpool(
        run_scenario,
        scenario,
        ctx.actuals,
        ctx.prices,
        ctx.cutoff,
        forecast=ctx.forecast,
        history=ctx.history,
    )
    return MetricsResponse(**metrics)


@router.post("/compare", response_model=CompareResponse)
async def compare(body: CompareRequest, ctx: CopilotContext = Depends(get_context)):
    """Compare the forecast-driven policy against naive at one setting (default is cached)."""
    is_default = (body.lead_time, body.review_period, body.service_level) == (7, 7, 0.95)
    if is_default:
        result = await run_in_threadpool(get_compare_default)
    else:
        result = await run_in_threadpool(
            compare_metrics, ctx, body.lead_time, body.review_period, body.service_level
        )
    return CompareResponse(
        base_stock=MetricsResponse(**result["base_stock"]),
        naive=MetricsResponse(**result["naive"]),
        delta=result["delta"],
    )


@router.get("/pareto", response_model=list[ParetoRow])
async def pareto(
    service_levels: list[float] = Query(default=DEFAULT_SERVICE_LEVELS),
    ctx: CopilotContext = Depends(get_context),
):
    """The service-vs-cost trade-off curve for both policies (default levels are cached)."""
    if service_levels == DEFAULT_SERVICE_LEVELS:
        curve = await run_in_threadpool(get_pareto_default)
    else:
        curve = await run_in_threadpool(
            service_cost_curve,
            ctx.forecast,
            ctx.history,
            ctx.actuals,
            ctx.prices,
            ctx.cutoff,
            service_levels,
        )
    return curve.to_dicts()


@router.get("/scorecard", response_model=ScorecardResponse)
async def scorecard():
    """Headline accuracy (forecast) and decision-quality (policy vs naive) numbers (cached)."""
    s = await run_in_threadpool(get_scorecard)
    return ScorecardResponse(
        forecast=ForecastScore(**s["forecast"]), decision=DecisionScore(**s["decision"])
    )
