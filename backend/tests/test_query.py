"""The guarded read-only query layer behind the agent's query_data tool.

Validation tests are pure (no data). The execution test needs the processed Parquet, so it
skips when the dataset is absent (e.g. in CI).
"""

import pytest

from copilot.core.data.analytics import _features_glob
from copilot.core.data.query import MAX_ROWS, QueryError, run_read_query, validate_select

# --- validation (pure, always runs) -----------------------------------------------------


def test_validate_accepts_select_and_with():
    assert validate_select("SELECT item_id, sum(y) FROM features GROUP BY item_id")
    assert validate_select("WITH t AS (SELECT y FROM features) SELECT sum(y) FROM t")
    # trailing semicolon/whitespace is tolerated and stripped
    assert validate_select("  SELECT 1 FROM features ;  ") == "SELECT 1 FROM features"


@pytest.mark.parametrize(
    "sql",
    [
        "",
        "DROP TABLE features",
        "INSERT INTO features VALUES (1)",
        "UPDATE features SET y = 0",
        "DELETE FROM features",
        "ATTACH 'x.db'",
        "COPY features TO 'out.csv'",
        "INSTALL httpfs",
        "PRAGMA database_list",
        "SET memory_limit='1GB'",
        "SELECT * FROM read_parquet('/etc/passwd')",  # file access blocked
        "SELECT * FROM glob('/*')",
        "SELECT * FROM duckdb_settings()",
        "SELECT 1 FROM features; DROP TABLE features",  # multiple statements
        "WITH x AS (SELECT 1) DELETE FROM features",  # starts ok, hides a write
        "EXPLAIN SELECT 1",  # not a plain SELECT/WITH
    ],
)
def test_validate_rejects_unsafe(sql):
    with pytest.raises(QueryError):
        validate_select(sql)


# --- execution (needs data; skips without it) --------------------------------------------

import glob as _glob  # noqa: E402

_HAS_DATA = bool(_glob.glob(_features_glob(), recursive=True))
needs_data = pytest.mark.skipif(not _HAS_DATA, reason="processed features Parquet not present")


@needs_data
def test_run_read_query_returns_rows():
    out = run_read_query("SELECT store_id, sum(y) AS units FROM features GROUP BY store_id")
    assert set(out) == {"columns", "row_count", "truncated", "rows"}
    assert out["columns"] == ["store_id", "units"]
    assert out["row_count"] == len(out["rows"]) > 0
    assert all("store_id" in row and "units" in row for row in out["rows"])


@needs_data
def test_run_read_query_caps_rows():
    out = run_read_query("SELECT ds, y FROM features", row_cap=5)
    assert out["row_count"] == 5
    assert out["truncated"] is True


@needs_data
def test_run_read_query_row_cap_never_exceeds_max():
    out = run_read_query("SELECT ds FROM features", row_cap=10_000)
    assert out["row_count"] <= MAX_ROWS
