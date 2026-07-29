"""Global LightGBM forecaster via mlforecast.

One model is trained across all series (a "global" model). mlforecast generates the
time-series features (lags, rolling means, calendar parts) and predicts the horizon
recursively, feeding each day's prediction back in as the next day's lag — so no
future information leaks into a past feature.
"""

from __future__ import annotations

import lightgbm as lgb
import pandas as pd
import polars as pl
from mlforecast import MLForecast
from mlforecast.lag_transforms import RollingMean

from copilot.core.forecast.baseline import HORIZON

STATIC: list[str] = ["dept_id", "store_id", "state_id"]


def make_forecaster() -> MLForecast:
    """A global LightGBM with weekly/monthly lags, rolling means, and calendar parts."""
    return MLForecast(
        models={
            "lgbm": lgb.LGBMRegressor(
                n_estimators=100,
                learning_rate=0.05,
                num_leaves=64,
                random_state=0,
                verbosity=-1,
            )
        },
        freq="D",
        lags=[7, 14, 28],
        lag_transforms={7: [RollingMean(window_size=7)], 28: [RollingMean(window_size=28)]},
        date_features=["dayofweek", "month", "day"],
    )


def train_and_forecast(train: pl.LazyFrame, horizon: int = HORIZON) -> pl.LazyFrame:
    """Fit on the training frame and return (unique_id, ds, yhat) for the horizon."""
    df = train.select("unique_id", "ds", "y", *STATIC).collect().to_pandas()
    df["ds"] = pd.to_datetime(df["ds"])
    for col in STATIC:
        df[col] = df[col].astype("category")

    fcst = make_forecaster()
    fcst.fit(df, static_features=STATIC)
    out = fcst.predict(h=horizon)

    return (
        pl.from_pandas(out)
        .rename({"lgbm": "yhat"})
        .with_columns(pl.col("ds").cast(pl.Date))
        .lazy()
    )
