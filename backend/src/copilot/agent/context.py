"""The heavy data the agent's tools need, loaded once and carried behind the scenes.

The language model can hand a tool a number like ``service_level=0.98`` — it cannot
hand it a 14,000-row forecast, and that data should never travel through the model
anyway. So we load the forecast / actual sales / prices / cutoff ONCE into a
``CopilotContext``; each tool keeps a private reference to it (a closure). The model
only ever sees the decision knobs; the machinery those knobs drive is already plugged in.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import polars as pl

from copilot.config import Settings, settings
from copilot.core.data.load import read_features
from copilot.core.forecast.baseline import split_by_horizon


@dataclass(frozen=True)
class CopilotContext:
    """Everything the tools need to run a scenario, prepared up front."""

    forecast: pl.LazyFrame  # quantile forecast over the holdout horizon
    history: pl.LazyFrame  # past actual sales (for the naive policy)
    actuals: pl.DataFrame  # real demand over the horizon (what the sim replays)
    prices: pl.DataFrame  # unique_id + unit_price, for costing
    cutoff: date  # forecast origin ("today")


def load_context(cfg: Settings = settings) -> CopilotContext:
    """Load features, split at the horizon, and attach the cached quantile forecast."""
    forecast_path = cfg.processed_dir / "forecast_quantiles.parquet"
    if not forecast_path.exists():
        raise FileNotFoundError(
            f"Cached forecast not found at {forecast_path}. "
            "Train it first (the forecast pipeline) before starting the agent."
        )

    features = read_features()
    train, test, cutoff = split_by_horizon(features)
    forecast = pl.read_parquet(forecast_path).lazy()
    actuals = test.select("unique_id", "ds", "y").collect()
    prices = (
        train.filter(pl.col("sell_price").is_not_null())
        .group_by("unique_id")
        .agg(pl.col("sell_price").sort_by("ds").last().alias("unit_price"))
        .collect()
    )
    return CopilotContext(
        forecast=forecast, history=train, actuals=actuals, prices=prices, cutoff=cutoff
    )
