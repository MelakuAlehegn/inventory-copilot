"""Guarded read-only SQL over the processed ``features`` data (DuckDB on Parquet).

This backs the agent's ``query_data`` tool: it lets the model answer recorded-data questions
(sales, prices, events, by item/store/date) with real aggregations instead of guessing. The
data is historical M5 FOODS sales - it does NOT contain inventory positions or stockouts;
those come from the simulation tools.

Safety is defense-in-depth, because the SQL is model-generated:
- only a SINGLE statement, and only ``SELECT`` / ``WITH`` (no writes, DDL, or PRAGMA);
- a keyword denylist blocks file access (``read_parquet`` etc.), ATTACH/COPY/INSTALL/LOAD and
  DuckDB metadata functions, so a query can't escape the ``features`` view or touch the disk;
- a hard row cap, enforced by fetching at most ``cap + 1`` rows (the extra one only tells us
  whether the result was truncated).
The connection is read-only in effect (only a ``features`` view exists) and per-call.
"""

from __future__ import annotations

import datetime as dt
import re
from typing import Any

from copilot.core.data.analytics import _connect

MAX_ROWS = 200

# Any of these tokens anywhere in the query rejects it. Covers writes/DDL, file- and
# catalog-access functions (read_*, glob, *_scan), ATTACH/COPY/INSTALL/LOAD, config (SET), and
# DuckDB/sqlite/pg metadata tables. Word-boundary matched, case-insensitive.
_FORBIDDEN = re.compile(
    r"\b("
    r"attach|detach|copy|install|load|pragma|set|reset|export|import|create|insert|"
    r"update|delete|drop|alter|truncate|replace|call|checkpoint|vacuum|analyze|"
    r"read_[a-z_]+|glob|[a-z_]*_scan|sniff_csv|system|getenv|"
    r"duckdb_[a-z_]+|sqlite_[a-z_]+|pg_[a-z_]+"
    r")\b",
    re.IGNORECASE,
)
_STARTS_OK = re.compile(r"^\s*(select|with)\b", re.IGNORECASE)


class QueryError(ValueError):
    """A model-supplied query that violates the read-only guardrails."""


def validate_select(sql: str) -> str:
    """Return the cleaned SQL if it is a single safe read-only SELECT, else raise QueryError."""
    s = sql.strip().rstrip(";").strip()
    if not s:
        raise QueryError("empty query")
    if ";" in s:
        raise QueryError("only a single statement is allowed")
    if not _STARTS_OK.match(s):
        raise QueryError("only SELECT / WITH queries are allowed")
    hit = _FORBIDDEN.search(s)
    if hit:
        raise QueryError(f"disallowed keyword: {hit.group(1).lower()}")
    return s


def _clean(value: Any) -> Any:
    """Tidy a cell for the model: dates -> ISO strings, floats rounded, others unchanged."""
    if isinstance(value, float):
        return round(value, 4)
    if isinstance(value, (dt.date, dt.datetime)):
        return value.isoformat()
    return value


def run_read_query(sql: str, row_cap: int = MAX_ROWS) -> dict[str, Any]:
    """Validate and run a read-only query against ``features``; return columns + capped rows.

    The result dict has: ``columns`` (names), ``rows`` (list of dicts, at most ``row_cap``),
    ``row_count``, and ``truncated`` (True if more rows existed than the cap). Raises
    QueryError for a query that fails validation.
    """
    s = validate_select(sql)
    cap = max(1, min(row_cap, MAX_ROWS))
    con = _connect()
    try:
        cur = con.execute(s)
        columns = [d[0] for d in cur.description]
        fetched = cur.fetchmany(cap + 1)  # one extra row only tells us if it was truncated
    finally:
        con.close()
    truncated = len(fetched) > cap
    rows = [{col: _clean(val) for col, val in zip(columns, r, strict=True)} for r in fetched[:cap]]
    return {
        "columns": columns,
        "row_count": len(rows),
        "truncated": truncated,
        "rows": rows,
    }
