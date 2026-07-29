"""Load the raw M5 CSVs and slice them to a single category across all stores.

Reads the extracted M5 CSVs (``data/raw/m5/datasets``) with Polars and returns a
tidy long-format frame: one row per (series, day) with sales, price, calendar
events, and the state-relevant SNAP flag joined on. Filtering to the category
happens in wide format *before* the unpivot, so only the needed series are melted.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

from copilot.config import settings

DATASETS: Path = settings.raw_dir / "m5" / "datasets"
ID_COLS: list[str] = ["item_id", "dept_id", "cat_id", "store_id", "state_id"]


def load_calendar() -> pl.LazyFrame:
    """Calendar with a derived ``d`` column (``d_1`` = earliest date) and parsed date."""
    return (
        pl.scan_csv(DATASETS / "calendar.csv")
        .sort("date")
        .with_row_index("d_index", offset=1)
        .with_columns(
            ("d_" + pl.col("d_index").cast(pl.Utf8)).alias("d"),
            pl.col("date").str.to_date(),
        )
        .select(
            "d",
            "date",
            "wm_yr_wk",
            "event_name_1",
            "event_type_1",
            "event_name_2",
            "event_type_2",
            "snap_CA",
            "snap_TX",
            "snap_WI",
        )
    )


def load_prices() -> pl.LazyFrame:
    """Weekly sell prices keyed by (store_id, item_id, wm_yr_wk)."""
    return pl.scan_csv(DATASETS / "sell_prices.csv")


def read_features() -> pl.LazyFrame:
    """Scan the materialized modeling frame, reconstructing store_id from the path."""
    root = settings.processed_dir / "features"
    return pl.scan_parquet(root / "**/*.parquet", hive_partitioning=True)


def load_slice(category: str = "FOODS", stores: list[str] | None = None) -> pl.LazyFrame:
    """Long-format sales for one category (default FOODS) across the given stores.

    Args:
        category: M5 ``cat_id`` to keep (FOODS, HOBBIES, or HOUSEHOLD).
        stores: optional ``store_id`` allow-list; ``None`` keeps all 10 stores.

    Returns:
        A LazyFrame with one row per (unique_id, date): sales, sell_price, the two
        event slots, and the resolved ``snap`` flag for the series' state.
    """
    sales = pl.scan_csv(DATASETS / "sales_train_evaluation.csv").filter(
        pl.col("cat_id") == category
    )
    if stores is not None:
        sales = sales.filter(pl.col("store_id").is_in(stores))

    sales = sales.with_columns((pl.col("item_id") + "_" + pl.col("store_id")).alias("unique_id"))
    day_cols = [c for c in sales.collect_schema().names() if c.startswith("d_")]

    long = sales.unpivot(
        index=["unique_id", *ID_COLS],
        on=day_cols,
        variable_name="d",
        value_name="sales",
    )

    long = long.join(load_calendar(), on="d", how="left").join(
        load_prices(), on=["store_id", "item_id", "wm_yr_wk"], how="left"
    )

    snap = (
        pl.when(pl.col("state_id") == "CA")
        .then(pl.col("snap_CA"))
        .when(pl.col("state_id") == "TX")
        .then(pl.col("snap_TX"))
        .otherwise(pl.col("snap_WI"))
        .cast(pl.Int8)
        .alias("snap")
    )

    return long.with_columns(snap, pl.col("sales").cast(pl.Int32)).select(
        "unique_id",
        "item_id",
        "dept_id",
        "cat_id",
        "store_id",
        "state_id",
        "date",
        "sales",
        "sell_price",
        "event_name_1",
        "event_type_1",
        "event_name_2",
        "event_type_2",
        "snap",
    )
