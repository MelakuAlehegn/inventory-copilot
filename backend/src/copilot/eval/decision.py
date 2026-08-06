"""Decision-quality eval: the forecast-driven policy vs the naive baseline.

The simulation math already exists (core/simulation: Scenario/run_scenario and the
service_cost_curve sweep). This module runs it and reports the decision-layer headline —
at a target service level, how much the forecast-driven policy reduces cost and stockouts
versus naive — plus the full service-vs-cost Pareto across service levels.

This is the layer that measures whether a better forecast leads to better *decisions*
(not just a more accurate prediction). Pure computation, no LLM.
Run:  python -m copilot.eval.decision   (or `make simulate`)
"""

from __future__ import annotations

from datetime import date

import polars as pl

from copilot.config import settings
from copilot.core.data.load import read_features
from copilot.core.forecast.baseline import split_by_horizon
from copilot.core.simulation.pareto import service_cost_curve

_SERVICE_LEVELS = [0.90, 0.95, 0.98, 0.99]
_HEADLINE_SL = 0.95


def decision_report(
    forecast: pl.LazyFrame,
    history: pl.LazyFrame,
    actuals: pl.DataFrame,
    prices: pl.DataFrame,
    cutoff: date,
    service_levels: list[float] = _SERVICE_LEVELS,
    headline_sl: float = _HEADLINE_SL,
) -> tuple[dict[str, float], pl.DataFrame]:
    """Return (headline summary at `headline_sl`, full Pareto curve)."""
    curve = service_cost_curve(forecast, history, actuals, prices, cutoff, service_levels)

    at = curve.filter(pl.col("service_level") == headline_sl)
    base = at.filter(pl.col("policy") == "base_stock").to_dicts()[0]
    naive = at.filter(pl.col("policy") == "naive").to_dicts()[0]
    # Positive = the forecast policy is lower (better) than naive.
    reduction = lambda k: (naive[k] - base[k]) / naive[k] if naive[k] else 0.0  # noqa: E731

    summary = {
        "service_level": headline_sl,
        "fill_rate_model": base["fill_rate"],
        "fill_rate_naive": naive["fill_rate"],
        "stockout_day_rate_model": base["stockout_day_rate"],
        "stockout_day_rate_naive": naive["stockout_day_rate"],
        "stockout_units_reduction": reduction("stockout_units"),
        "holding_cost_reduction": reduction("holding_cost"),
        "stockout_cost_reduction": reduction("stockout_cost"),
        "total_cost_reduction": reduction("total_cost"),
    }
    return summary, curve


def main() -> None:
    forecast_path = settings.processed_dir / "forecast_quantiles.parquet"
    if not forecast_path.exists():
        raise FileNotFoundError(
            f"Cached forecast not found at {forecast_path}. Train the quantile model first."
        )

    features = read_features()
    train, test, cutoff = split_by_horizon(features)
    actuals = test.select("unique_id", "ds", "y").collect()
    forecast = pl.read_parquet(forecast_path).lazy()
    prices = (
        train.filter(pl.col("sell_price").is_not_null())
        .group_by("unique_id")
        .agg(pl.col("sell_price").sort_by("ds").last().alias("unit_price"))
        .collect()
    )

    print("running decision eval (forecast policy vs naive)...")
    summary, curve = decision_report(forecast, train, actuals, prices, cutoff)

    sl = summary["service_level"]
    print(f"\n=== decision quality @ service target {sl:.0%} ===")
    print(f"  fill rate          model {summary['fill_rate_model']:.4f}  vs naive {summary['fill_rate_naive']:.4f}")
    print(f"  stockout-day rate  model {summary['stockout_day_rate_model']:.4f}  vs naive {summary['stockout_day_rate_naive']:.4f}")
    print(f"  stockout units reduction {summary['stockout_units_reduction']:+.1%}")
    print(f"  holding cost reduction   {summary['holding_cost_reduction']:+.1%}")
    print(f"  stockout cost reduction  {summary['stockout_cost_reduction']:+.1%}")
    print(f"  total cost reduction     {summary['total_cost_reduction']:+.1%}")

    print("\n=== service-vs-cost Pareto ===")
    show = curve.select(
        "service_level",
        "policy",
        pl.col("fill_rate").round(4),
        pl.col("stockout_day_rate").round(4),
        (pl.col("holding_cost") + pl.col("stockout_cost")).round(0).alias("inv_cost"),
        pl.col("total_cost").round(0),
    )
    with pl.Config(tbl_rows=20, tbl_width_chars=120):
        print(show.sort("service_level", "policy"))


if __name__ == "__main__":
    main()
