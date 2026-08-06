"""Forecast-accuracy eval: our quantile model vs the seasonal-naive baseline.

The metric math already lives in core/forecast/metrics.py (WRMSSE, pinball). This module
just *runs* it: it scores our model's point forecast (the median, q50) and the
seasonal-naive baseline with the same WRMSSE, reports the improvement, and adds the
model's pinball loss (which scores the full demand distribution). The headline is the
improvement over naive — a model that can't beat "next week looks like last week" isn't
earning its keep.

Pure computation, no LLM. Run:  copilot-eval-forecast
"""

from __future__ import annotations

from datetime import date

import polars as pl

from copilot.config import settings
from copilot.core.data.load import read_features
from copilot.core.forecast.baseline import seasonal_naive, split_by_horizon
from copilot.core.forecast.metrics import average_pinball, wrmsse
from copilot.core.forecast.model import QUANTILES


def evaluate_forecast(
    train: pl.LazyFrame,
    quantile_forecast: pl.LazyFrame,
    actuals: pl.LazyFrame,
    cutoff: date,
) -> dict[str, float]:
    """Score our model vs seasonal-naive on WRMSSE, plus the model's pinball loss."""
    model_point = quantile_forecast.select("unique_id", "ds", pl.col("q50").alias("yhat"))
    naive_point = seasonal_naive(train, cutoff)

    model_w = wrmsse(train, model_point, actuals, cutoff)
    naive_w = wrmsse(train, naive_point, actuals, cutoff)
    pinball = average_pinball(quantile_forecast, actuals, QUANTILES)

    improvement = (naive_w["wrmsse"] - model_w["wrmsse"]) / naive_w["wrmsse"]
    return {
        "wrmsse_model": model_w["wrmsse"],
        "wrmsse_naive": naive_w["wrmsse"],
        "wrmsse_improvement": improvement,  # fraction; >0 means model beats naive
        "mean_rmsse_model": model_w["mean_rmsse"],
        "pinball_mean": pinball["mean"],
        "n_series": model_w["n_series"],
    }


def main() -> None:
    forecast_path = settings.processed_dir / "forecast_quantiles.parquet"
    if not forecast_path.exists():
        raise FileNotFoundError(
            f"Cached forecast not found at {forecast_path}. Train the quantile model first."
        )

    features = read_features()
    train, test, cutoff = split_by_horizon(features)
    actuals = test.select("unique_id", "ds", "y")
    quantile_forecast = pl.read_parquet(forecast_path).lazy()

    print("scoring forecast (model vs seasonal-naive)...")
    scores = evaluate_forecast(train, quantile_forecast, actuals, cutoff)

    print("\n=== forecast accuracy ===")
    print(f"  WRMSSE  model        {scores['wrmsse_model']:.4f}")
    print(f"  WRMSSE  seasonal-naive {scores['wrmsse_naive']:.4f}")
    print(f"  improvement over naive {scores['wrmsse_improvement']:+.1%}")
    print(f"  mean RMSSE (model)   {scores['mean_rmsse_model']:.4f}")
    print(f"  pinball loss (mean)  {scores['pinball_mean']:.4f}")
    print(f"  series scored        {scores['n_series']:,}")


if __name__ == "__main__":
    main()
