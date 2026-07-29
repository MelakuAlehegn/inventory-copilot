"""Seasonal-naive forecast baseline and the backtest split it uses.

Seasonal-naive is the honest reference the LightGBM model must beat: it forecasts
each future day as the value from the same weekday in the last observed week
(weekly season = 7). If a fancy model can't beat "assume next week looks like last
week," it isn't earning its complexity.
"""

from __future__ import annotations

from datetime import date, timedelta

import polars as pl

HORIZON = 28  # M5 forecast horizon (days)
SEASON = 7  # weekly seasonality


def split_by_horizon(
    lf: pl.LazyFrame, horizon: int = HORIZON
) -> tuple[pl.LazyFrame, pl.LazyFrame, date]:
    """Hold out the last ``horizon`` days as the test window.

    Returns (train, test, cutoff): train is ds <= cutoff, test is ds > cutoff.
    """
    max_ds: date = lf.select(pl.col("ds").max()).collect().item()
    cutoff = max_ds - timedelta(days=horizon)
    return lf.filter(pl.col("ds") <= cutoff), lf.filter(pl.col("ds") > cutoff), cutoff


def seasonal_naive(
    train: pl.LazyFrame, cutoff: date, horizon: int = HORIZON, season: int = SEASON
) -> pl.LazyFrame:
    """Forecast the next ``horizon`` days by tiling each series' last ``season`` days.

    Returns a LazyFrame of (unique_id, ds, yhat) for the horizon after ``cutoff``.
    """
    # Keep only the last `season` rows per series, positioned 0..season-1 by date.
    ranked = train.select("unique_id", "ds", "y").with_columns(
        rn=pl.int_range(pl.len()).over("unique_id", order_by="ds"),
        cnt=pl.len().over("unique_id"),
    )
    last_week = ranked.filter(pl.col("rn") >= pl.col("cnt") - season).with_columns(
        pos=(pl.col("rn") - (pl.col("cnt") - season)).cast(pl.Int32)
    )

    # Horizon calendar: future day h maps to weekday position h % season.
    horizon_index = pl.LazyFrame(
        {
            "ds": [cutoff + timedelta(days=i + 1) for i in range(horizon)],
            "pos": [pl.Series([i % season for i in range(horizon)]).cast(pl.Int32)][0],
        }
    )

    grid = train.select("unique_id").unique().join(horizon_index, how="cross")
    return grid.join(
        last_week.select("unique_id", "pos", pl.col("y").alias("yhat")),
        on=["unique_id", "pos"],
        how="left",
    ).select("unique_id", "ds", "yhat")
