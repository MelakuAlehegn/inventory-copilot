"""The fitted quantile forecaster can be saved and reloaded to serve without retraining.

Uses a tiny synthetic panel (no M5 data), so it runs anywhere including CI.
"""

import datetime as dt

import polars as pl

from copilot.core.forecast.model import (
    QUANTILES,
    _qname,
    fit_quantile_forecaster,
    load_forecaster,
    quantile_forecast,
    save_forecaster,
)


def _synthetic_panel() -> pl.LazyFrame:
    """Two series, 90 daily rows each (enough history for the 28-day lags/rolling means)."""
    rows = []
    for uid, store in [("A_CA_1", "CA_1"), ("B_TX_1", "TX_1")]:
        for i in range(90):
            rows.append(
                {
                    "unique_id": uid,
                    "item_id": uid,
                    "dept_id": "FOODS_1",
                    "store_id": store,
                    "state_id": store[:2],
                    "ds": dt.date(2020, 1, 1) + dt.timedelta(days=i),
                    "y": 10 + (i % 7),
                }
            )
    return pl.DataFrame(rows).lazy()


def test_quantile_forecaster_save_load_roundtrip(tmp_path):
    train = _synthetic_panel()
    fcst = fit_quantile_forecaster(train)

    path = tmp_path / "quantile_model"
    save_forecaster(fcst, path)
    assert path.exists()

    reloaded = load_forecaster(path)
    out = quantile_forecast(reloaded, horizon=7).collect()

    assert out.height == 2 * 7  # two series x 7-day horizon
    for q in QUANTILES:
        assert _qname(q) in out.columns
    # Quantiles stay monotonic across the row (no crossing).
    row = out.row(0, named=True)
    assert row["q50"] <= row["q90"] <= row["q99"]
