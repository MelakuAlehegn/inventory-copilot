"""Full 3-layer eval scorecard: forecast + decision (+ agent, opt-in).

Run with `python -m copilot.eval` (or `make eval`). The forecast and decision layers are
pure computation and always run; the agent layer needs the LLM, so it is opt-in via
--with-agent (with the same --quick/--judge/--rps knobs as the standalone agent eval).
Data is loaded once and shared across all layers.
"""

from __future__ import annotations

import argparse

import polars as pl

from copilot.config import settings
from copilot.core.data.load import read_features
from copilot.core.forecast.baseline import split_by_horizon
from copilot.eval.decision import decision_report
from copilot.eval.forecast import evaluate_forecast


def _run_agent_layer(forecast, train, actuals_df, prices, cutoff, args) -> dict:
    """Imported lazily so the default (quota-free) run never touches the LLM stack."""
    from copilot.agent.context import CopilotContext
    from copilot.agent.graph import build_agent
    from copilot.agent.providers import get_chat_model
    from copilot.eval.agent import run_eval, smoke_subset, summarize
    from copilot.eval.agent_gold import GOLD

    ctx = CopilotContext(
        forecast=forecast, history=train, actuals=actuals_df, prices=prices, cutoff=cutoff
    )
    model = get_chat_model(rate_limit_rps=args.rps)
    agent = build_agent(ctx, model=model)
    judge_model = model if args.judge else None
    questions = smoke_subset(GOLD) if args.quick else GOLD
    return summarize(run_eval(agent, questions, judge_model=judge_model))


def _print_scorecard(fc: dict, dec: dict, agent: dict | None) -> None:
    print("\n" + "=" * 48)
    print("  INVENTORY COPILOT — 3-LAYER EVAL SCORECARD")
    print("=" * 48)

    print("\nFORECAST  (accuracy vs seasonal-naive)")
    print(f"  WRMSSE  model / naive     {fc['wrmsse_model']:.4f} / {fc['wrmsse_naive']:.4f}")
    print(f"  improvement over naive    {fc['wrmsse_improvement']:+.1%}")
    print(f"  pinball loss (mean)       {fc['pinball_mean']:.4f}")

    print(f"\nDECISION  (forecast policy vs naive @ {dec['service_level']:.0%} service)")
    print(f"  fill rate  model / naive  {dec['fill_rate_model']:.4f} / {dec['fill_rate_naive']:.4f}")
    print(f"  stockout units reduction  {dec['stockout_units_reduction']:+.1%}")
    print(f"  stockout cost reduction   {dec['stockout_cost_reduction']:+.1%}")
    print(f"  total cost reduction      {dec['total_cost_reduction']:+.1%}")

    print("\nAGENT  (grounded LLM over the tools)")
    if agent is None:
        print("  (skipped — add --with-agent to run; needs the LLM)")
    else:
        print(f"  evaluable / errors        {agent['evaluable']} / {agent['errors']}")
        print(f"  tool-selection accuracy   {agent['tool_selection_accuracy']:.1%}")
        print(f"  delivered grounded rate   {agent['delivered_grounded_rate']:.1%}")
        if "refusal_accuracy" in agent:
            print(f"  refusal accuracy          {agent['refusal_accuracy']:.1%}")
            print(f"  avg answer quality (1-5)  {agent['avg_quality']:.2f}")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(description="Full 3-layer eval scorecard.")
    parser.add_argument("--with-agent", action="store_true", help="also run the agent layer (needs LLM)")
    parser.add_argument("--quick", action="store_true", help="agent: one question per kind")
    parser.add_argument("--judge", action="store_true", help="agent: also run the LLM-judge")
    parser.add_argument("--rps", type=float, default=None, help="agent: cap requests/second")
    args = parser.parse_args()

    forecast_path = settings.processed_dir / "forecast_quantiles.parquet"
    if not forecast_path.exists():
        raise FileNotFoundError(
            f"Cached forecast not found at {forecast_path}. Train the quantile model first."
        )

    print("loading data...")
    features = read_features()
    train, test, cutoff = split_by_horizon(features)
    actuals_lf = test.select("unique_id", "ds", "y")
    actuals_df = actuals_lf.collect()
    forecast = pl.read_parquet(forecast_path).lazy()
    prices = (
        train.filter(pl.col("sell_price").is_not_null())
        .group_by("unique_id")
        .agg(pl.col("sell_price").sort_by("ds").last().alias("unit_price"))
        .collect()
    )

    print("[forecast] scoring vs seasonal-naive...")
    fc = evaluate_forecast(train, forecast, actuals_lf, cutoff)
    print("[decision] simulating policy vs naive...")
    dec, _curve = decision_report(forecast, train, actuals_df, prices, cutoff)
    agent = _run_agent_layer(forecast, train, actuals_df, prices, cutoff, args) if args.with_agent else None

    _print_scorecard(fc, dec, agent)


if __name__ == "__main__":
    main()
