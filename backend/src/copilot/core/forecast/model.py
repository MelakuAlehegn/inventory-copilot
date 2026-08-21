"""Global LightGBM forecaster via mlforecast.

One model is trained across all series (a "global" model). mlforecast generates the
time-series features (lags, rolling means, calendar parts) and predicts the horizon
recursively, feeding each day's prediction back in as the next day's lag — so no
future information leaks into a past feature.

Two flavors share the same feature config:
- a point forecaster (single model), and
- a quantile forecaster (one LightGBM per quantile, via the quantile objective) that
  emits a demand distribution for safety-stock math.
"""

from __future__ import annotations

import lightgbm as lgb
import pandas as pd
import polars as pl
from mlforecast import MLForecast
from mlforecast.lag_transforms import RollingMean

from copilot.core.forecast.baseline import HORIZON

STATIC: list[str] = ["dept_id", "store_id", "state_id"]
QUANTILES: list[float] = [0.5, 0.8, 0.9, 0.95, 0.99]

_LAGS = [7, 14, 28]
_LAG_TRANSFORMS = {7: [RollingMean(window_size=7)], 28: [RollingMean(window_size=28)]}
_DATE_FEATURES = ["dayofweek", "month", "day"]


_LGBM_PARAMS: dict = {
    "n_estimators": 100,
    "learning_rate": 0.05,
    "num_leaves": 64,
    "random_state": 0,
    "verbosity": -1,
}


def _lgbm(**kwargs: object) -> lgb.LGBMRegressor:
    return lgb.LGBMRegressor(**{**_LGBM_PARAMS, **kwargs})


def model_params() -> dict:
    """Flat model + feature configuration, for experiment logging."""
    return {
        "quantiles": QUANTILES,
        "lags": _LAGS,
        "date_features": _DATE_FEATURES,
        "horizon": HORIZON,
        **_LGBM_PARAMS,
    }


def _feature_kwargs() -> dict:
    return {
        "freq": "D",
        "lags": _LAGS,
        "lag_transforms": _LAG_TRANSFORMS,
        "date_features": _DATE_FEATURES,
    }


def _qname(q: float) -> str:
    return f"q{int(round(q * 100))}"


def _training_frame(train: pl.LazyFrame) -> pd.DataFrame:
    df = train.select("unique_id", "ds", "y", *STATIC).collect().to_pandas()
    df["ds"] = pd.to_datetime(df["ds"])
    for col in STATIC:
        df[col] = df[col].astype("category")
    return df


def make_forecaster() -> MLForecast:
    """Global point forecaster."""
    return MLForecast(models={"lgbm": _lgbm()}, **_feature_kwargs())


def make_quantile_forecaster(quantiles: list[float] = QUANTILES) -> MLForecast:
    """Global quantile forecaster: one LightGBM per quantile (quantile objective)."""
    models = {_qname(q): _lgbm(objective="quantile", alpha=q) for q in quantiles}
    return MLForecast(models=models, **_feature_kwargs())


def train_and_forecast(train: pl.LazyFrame, horizon: int = HORIZON) -> pl.LazyFrame:
    """Fit the point model and return (unique_id, ds, yhat) for the horizon."""
    df = _training_frame(train)
    fcst = make_forecaster()
    fcst.fit(df, static_features=STATIC)
    out = fcst.predict(h=horizon)
    return (
        pl.from_pandas(out).rename({"lgbm": "yhat"}).with_columns(pl.col("ds").cast(pl.Date)).lazy()
    )


def train_and_forecast_quantiles(
    train: pl.LazyFrame, horizon: int = HORIZON, quantiles: list[float] = QUANTILES
) -> pl.LazyFrame:
    """Fit one model per quantile and return (unique_id, ds, q50, q80, ...).

    Quantiles are post-sorted per row (running max across increasing quantiles) so a
    higher quantile can never fall below a lower one ("quantile crossing").
    """
    df = _training_frame(train)
    fcst = make_quantile_forecaster(quantiles)
    fcst.fit(df, static_features=STATIC)
    out = pl.from_pandas(fcst.predict(h=horizon)).with_columns(pl.col("ds").cast(pl.Date))

    qcols = [_qname(q) for q in quantiles]
    acc = pl.col(qcols[0])
    monotone = []
    for col in qcols[1:]:
        acc = pl.max_horizontal(acc, pl.col(col))
        monotone.append(acc.alias(col))
    if monotone:
        out = out.with_columns(monotone)
    return out.lazy()
