"""Rolling-origin backtest: forecast accuracy averaged over several cutoffs.

A single holdout can flatter or punish a model by the luck of one window. This retrains at
several successive origins (each stepping back by the horizon), scores WRMSSE + pinball vs
seasonal-naive at each, and averages — a robust, no-leakage estimate: every origin trains
only on data strictly before its cutoff.

Each origin is a full model train, so this is a heavy job — use ``--sample`` for a fast dev
pass and the full set for the headline.
Run:  python -m copilot.eval.backtest [--origins N] [--step D] [--sample K]   (make backtest)
"""

from __future__ import annotations

import argparse
from datetime import date, timedelta

import polars as pl

from copilot.core.data.load import read_features
from copilot.core.forecast.baseline import HORIZON
from copilot.core.forecast.model import train_and_forecast_quantiles
from copilot.eval.forecast import evaluate_forecast

_METRIC_KEYS = [
    "wrmsse_model",
    "wrmsse_naive",
    "wrmsse_improvement",
    "mean_rmsse_model",
    "pinball_mean",
]


def rolling_origin_backtest(
    features: pl.LazyFrame,
    n_origins: int = 4,
    step: int = HORIZON,
    horizon: int = HORIZON,
    sample: int | None = None,
) -> list[dict]:
    """Score the model at ``n_origins`` cutoffs, each ``step`` days apart. One row per origin."""
    max_ds: date = features.select(pl.col("ds").max()).collect().item()
    if sample:
        ids = (
            features.select("unique_id")
            .unique()
            .sort("unique_id")
            .head(sample)
            .collect()["unique_id"]
            .to_list()
        )
        features = features.filter(pl.col("unique_id").is_in(ids))

    rows: list[dict] = []
    for i in range(n_origins):
        cutoff = max_ds - timedelta(days=horizon + i * step)
        window_end = cutoff + timedelta(days=horizon)
        train = features.filter(pl.col("ds") <= cutoff)  # strictly past -> no leakage
        actuals = features.filter((pl.col("ds") > cutoff) & (pl.col("ds") <= window_end)).select(
            "unique_id", "ds", "y"
        )

        forecast = train_and_forecast_quantiles(train, horizon)
        metrics = evaluate_forecast(train, forecast, actuals, cutoff)
        rows.append({"origin": str(cutoff), **metrics})
        print(
            f"  origin {cutoff}: WRMSSE {metrics['wrmsse_model']:.4f} "
            f"({metrics['wrmsse_improvement']:+.1%} vs naive)"
        )
    return rows


def summarize(rows: list[dict]) -> dict[str, float]:
    n = len(rows)
    return {k: sum(r[k] for r in rows) / n for k in _METRIC_KEYS}


def main() -> None:
    parser = argparse.ArgumentParser(description="Rolling-origin forecast backtest.")
    parser.add_argument("--origins", type=int, default=4, help="number of cutoffs to score")
    parser.add_argument("--step", type=int, default=HORIZON, help="days between cutoffs")
    parser.add_argument("--sample", type=int, default=None, help="only N series (fast dev pass)")
    args = parser.parse_args()

    features = read_features()
    scope = f"sample {args.sample} series" if args.sample else "all series"
    print(f"rolling-origin backtest: {args.origins} origins, step {args.step}d, {scope}")
    rows = rolling_origin_backtest(features, args.origins, args.step, sample=args.sample)

    s = summarize(rows)
    print("\n=== rolling-origin averages ===")
    print(f"  WRMSSE  model / naive   {s['wrmsse_model']:.4f} / {s['wrmsse_naive']:.4f}")
    print(f"  improvement over naive  {s['wrmsse_improvement']:+.1%}")
    print(f"  mean RMSSE (model)      {s['mean_rmsse_model']:.4f}")
    print(f"  pinball loss (mean)     {s['pinball_mean']:.4f}")
    print(f"  origins scored          {len(rows)}")


if __name__ == "__main__":
    main()
