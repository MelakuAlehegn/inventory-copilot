"""Train the LightGBM quantile forecaster and cache its horizon forecast.

Fits the global quantile model on the training split (everything up to the holdout
cutoff — no leakage) and writes the per-series quantile forecast for the horizon to
``data/processed/forecast_quantiles.parquet``. That artifact is what the policy,
simulation, and eval layers read, so training is one reproducible command rather than an
ad-hoc script.

Run with::

    make train
    python -m copilot.pipelines.train
"""

from __future__ import annotations

import polars as pl

from copilot.config import settings
from copilot.core.data.load import read_features
from copilot.core.forecast.baseline import split_by_horizon
from copilot.core.forecast.model import QUANTILES, train_and_forecast_quantiles


def main() -> None:
    features = read_features()
    train, _test, cutoff = split_by_horizon(features)
    n_series = train.select(pl.col("unique_id").n_unique()).collect().item()
    print(
        f"training quantile forecaster on {n_series:,} series "
        f"(cutoff {cutoff}, quantiles {QUANTILES})..."
    )

    forecast = train_and_forecast_quantiles(train).collect()

    out_path = settings.processed_dir / "forecast_quantiles.parquet"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    forecast.write_parquet(out_path)
    print(
        f"wrote {forecast.height:,} rows "
        f"({forecast['unique_id'].n_unique():,} series x {forecast['ds'].n_unique()} days) "
        f"-> {out_path}"
    )


if __name__ == "__main__":
    main()
