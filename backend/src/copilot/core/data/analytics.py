"""Read-only analytics over the processed features, via DuckDB SQL on the Parquet.

DuckDB queries the Hive-partitioned Parquet directly (no load into memory), which is a good
fit for the flexible aggregations dashboards need. Each call uses its own connection
(DuckDB connections aren't shared across threads) exposing a ``features`` view.
Revenue = units (y) x sell_price; rows with no price are ignored by the sum.
"""

from __future__ import annotations

import duckdb

from copilot.config import settings

_KPI_KEYS = [
    "n_series",
    "n_stores",
    "start_date",
    "end_date",
    "total_units",
    "total_revenue",
    "avg_daily_demand",
]


def _features_glob() -> str:
    return str((settings.processed_dir / "features").resolve() / "**" / "*.parquet")


def _connect() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute(
        "CREATE VIEW features AS "
        f"SELECT * FROM read_parquet('{_features_glob()}', hive_partitioning => true)"
    )
    return con


def kpis() -> dict:
    """Headline dataset KPIs."""
    con = _connect()
    try:
        row = con.execute(
            """
            SELECT count(DISTINCT unique_id) AS n_series,
                   count(DISTINCT store_id)  AS n_stores,
                   min(ds) AS start_date, max(ds) AS end_date,
                   sum(y) AS total_units,
                   sum(y * sell_price) AS total_revenue,
                   avg(y) AS avg_daily_demand
            FROM features
            """
        ).fetchone()
    finally:
        con.close()
    return dict(zip(_KPI_KEYS, row, strict=True))


def top_series(metric: str = "revenue", limit: int = 10) -> list[dict]:
    """Top series (item x store) by total revenue or units."""
    order_col = "revenue" if metric == "revenue" else "units"
    con = _connect()
    try:
        rows = con.execute(
            f"""
            SELECT unique_id,
                   any_value(item_id)  AS item_id,
                   any_value(store_id) AS store_id,
                   sum(y) AS units,
                   sum(y * sell_price) AS revenue
            FROM features
            GROUP BY unique_id
            ORDER BY {order_col} DESC NULLS LAST
            LIMIT ?
            """,
            [limit],
        ).fetchall()
        cols = ["unique_id", "item_id", "store_id", "units", "revenue"]
    finally:
        con.close()
    return [dict(zip(cols, r, strict=True)) for r in rows]


def series_options() -> dict:
    """Distinct item and store ids, for the forecast series selector (single scan)."""
    con = _connect()
    try:
        rows = con.execute("SELECT DISTINCT item_id, store_id FROM features").fetchall()
    finally:
        con.close()
    items = sorted({r[0] for r in rows})
    stores = sorted({r[1] for r in rows})
    return {"items": items, "stores": stores}


def series_detail(unique_id: str) -> dict | None:
    """Per-series drilldown: daily units/revenue time series + summary. None if unknown."""
    con = _connect()
    try:
        summary = con.execute(
            """
            SELECT any_value(item_id) AS item_id, any_value(store_id) AS store_id,
                   count(*) AS n_days, min(ds) AS start_date, max(ds) AS end_date,
                   sum(y) AS total_units, sum(y * sell_price) AS total_revenue,
                   avg(sell_price) AS avg_price
            FROM features WHERE unique_id = ?
            """,
            [unique_id],
        ).fetchone()
        if summary is None or summary[2] == 0:  # n_days == 0 -> unknown id
            return None
        points = con.execute(
            "SELECT ds, y AS units, y * sell_price AS revenue "
            "FROM features WHERE unique_id = ? ORDER BY ds",
            [unique_id],
        ).fetchall()
    finally:
        con.close()

    keys = [
        "item_id",
        "store_id",
        "n_days",
        "start_date",
        "end_date",
        "total_units",
        "total_revenue",
        "avg_price",
    ]
    detail = dict(zip(keys, summary, strict=True))
    detail["unique_id"] = unique_id
    detail["series"] = [{"ds": ds, "units": u, "revenue": rev} for ds, u, rev in points]
    return detail


def stores() -> list[dict]:
    """Per-store totals."""
    con = _connect()
    try:
        rows = con.execute(
            """
            SELECT store_id,
                   count(DISTINCT unique_id) AS n_series,
                   sum(y) AS total_units,
                   sum(y * sell_price) AS total_revenue
            FROM features
            GROUP BY store_id
            ORDER BY total_revenue DESC
            """
        ).fetchall()
        cols = ["store_id", "n_series", "total_units", "total_revenue"]
    finally:
        con.close()
    return [dict(zip(cols, r, strict=True)) for r in rows]
