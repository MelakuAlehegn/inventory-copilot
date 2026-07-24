"""Clean the raw slice and build domain features into a modeling-ready frame.

Responsibilities here: drop each series' pre-launch period, turn the literal ``"NA"``
event strings into real nulls, and derive causal price features. Time-series features
(lags and rolling stats of the target) and calendar parts are produced later by
mlforecast at model time, so they are intentionally NOT built here.

The output uses the forecasting convention: ``ds`` for the date and ``y`` for the
target (units sold).
"""

from __future__ import annotations

import polars as pl

from copilot.core.data.load import load_slice

EVENT_COLS: list[str] = ["event_name_1", "event_type_1", "event_name_2", "event_type_2"]


def normalize_events(lf: pl.LazyFrame) -> pl.LazyFrame:
    """Replace the sentinel string ``"NA"`` with a real null in every event column."""
    return lf.with_columns(
        pl.when(pl.col(c) == "NA").then(None).otherwise(pl.col(c)).alias(c) for c in EVENT_COLS
    )


def trim_prelaunch(lf: pl.LazyFrame) -> pl.LazyFrame:
    """Drop each series' rows before its first non-zero sale.

    Assumes the frame is sorted by (unique_id, ds). A running max of ``y > 0`` over the
    series is 0 until the first sale and 1 from then on, so keeping ``== 1`` removes the
    pre-launch stretch (the ~22% null-price rows we saw) without touching later zeros.
    """
    launched = (pl.col("y") > 0).cast(pl.Int8).cum_max().over("unique_id")
    return lf.filter(launched == 1)


def add_price_features(lf: pl.LazyFrame) -> pl.LazyFrame:
    """Add causal price features (use only information available up to each day).

    Assumes the frame is sorted by (unique_id, ds).
        price_change: fractional change vs the previous day's price for the series
                      (0 within a week; non-zero when the weekly price moves).
        price_rel:    price relative to the series' running average price so far
                      (>1 = dearer than usual, <1 = on sale / cheaper than usual).
    """
    prev = pl.col("sell_price").shift(1).over("unique_id")
    run_mean = (
        pl.col("sell_price").cum_sum().over("unique_id")
        / pl.col("sell_price").cum_count().over("unique_id")
    )
    return lf.with_columns(
        (pl.col("sell_price") / prev - 1).alias("price_change"),
        (pl.col("sell_price") / run_mean).alias("price_rel"),
    )


def make_modeling_frame(
    category: str = "FOODS", stores: list[str] | None = None
) -> pl.LazyFrame:
    """Load the slice and return a cleaned, feature-enriched modeling frame."""
    lf = (
        load_slice(category, stores)
        .rename({"date": "ds", "sales": "y"})
        .sort("unique_id", "ds")
    )
    lf = normalize_events(lf)
    lf = trim_prelaunch(lf)
    lf = add_price_features(lf)
    return lf.select(
        "unique_id",
        "item_id",
        "dept_id",
        "store_id",
        "state_id",
        "ds",
        "y",
        "sell_price",
        "price_change",
        "price_rel",
        "event_name_1",
        "event_type_1",
        "event_name_2",
        "event_type_2",
        "snap",
    )
