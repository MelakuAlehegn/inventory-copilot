"""Forecast accuracy metrics: WRMSSE and pinball loss.

WRMSSE (Weighted Root Mean Squared Scaled Error) is the M5 competition metric. Here
we compute the **bottom-level** version: RMSSE per series, weighted by each series'
recent revenue share. (The full competition also averages RMSSE across 12 hierarchy
levels; for a single-category slice the bottom level is the meaningful, honest one.)

RMSSE for one series:
    RMSSE = sqrt( mean_h (y - yhat)^2  /  mean_train (y_t - y_{t-1})^2 )
The denominator scales the horizon error by the series' own day-to-day volatility,
so noisy and calm series become comparable. The numerator is the horizon MSE.

Pinball loss scores a single quantile forecast; averaged over quantiles it scores a
probabilistic forecast (used once the model emits demand quantiles).
"""

from __future__ import annotations

from datetime import date, timedelta

import polars as pl


def pinball_loss(y: pl.Expr, yhat: pl.Expr, q: float) -> pl.Expr:
    """Pinball (quantile) loss for quantile ``q``.

    Penalizes under-forecasts by ``q`` and over-forecasts by ``1 - q``, so high
    quantiles are punished more for coming in too low than too high.
    """
    err = y - yhat
    return pl.max_horizontal(q * err, (q - 1) * err)


def _series_scale(train: pl.LazyFrame) -> pl.LazyFrame:
    """Per-series denominator: mean squared 1-step difference over training history."""
    diff = pl.col("y") - pl.col("y").shift(1).over("unique_id")
    return (
        train.select("unique_id", "ds", "y")
        .sort("unique_id", "ds")
        .with_columns(diff.alias("diff"))
        .drop_nulls("diff")
        .group_by("unique_id")
        .agg((pl.col("diff") ** 2).mean().alias("scale"))
    )


def _series_weights(train: pl.LazyFrame, cutoff: date, window: int = 28) -> pl.LazyFrame:
    """Per-series weight: revenue (units x price) over the last ``window`` train days."""
    start = cutoff - timedelta(days=window - 1)
    return (
        train.filter(pl.col("ds") >= start)
        .with_columns((pl.col("y") * pl.col("sell_price")).fill_null(0).alias("rev"))
        .group_by("unique_id")
        .agg(pl.col("rev").sum().alias("rev"))
    )


def wrmsse(
    train: pl.LazyFrame,
    forecast: pl.LazyFrame,
    actuals: pl.LazyFrame,
    cutoff: date,
) -> dict[str, float]:
    """Weighted RMSSE of ``forecast`` (unique_id, ds, yhat) vs ``actuals`` (…, y).

    Returns the weighted WRMSSE, the unweighted mean RMSSE, and how many series were
    scored vs dropped (series with zero training volatility have an undefined scale).
    """
    horizon_mse = (
        forecast.join(actuals.select("unique_id", "ds", "y"), on=["unique_id", "ds"])
        .with_columns(((pl.col("y") - pl.col("yhat")) ** 2).alias("se"))
        .group_by("unique_id")
        .agg(pl.col("se").mean().alias("mse"))
    )

    per_series = (
        horizon_mse.join(_series_scale(train), on="unique_id")
        .join(_series_weights(train, cutoff), on="unique_id")
        .filter(pl.col("scale") > 0)
        .with_columns((pl.col("mse") / pl.col("scale")).sqrt().alias("rmsse"))
        .collect()
    )

    total_rev = per_series["rev"].sum()
    weighted = (per_series["rmsse"] * per_series["rev"]).sum() / total_rev
    return {
        "wrmsse": float(weighted),
        "mean_rmsse": float(per_series["rmsse"].mean()),
        "n_series": int(per_series.height),
    }
