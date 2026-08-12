"""Forecast endpoints registered with typed schemas (no data load needed)."""

from copilot.api.main import app


def test_forecast_routes_and_schemas_registered():
    spec = app.openapi()
    for path in ["/forecast/summary", "/forecast/series/{unique_id}"]:
        assert path in spec["paths"], f"missing route {path}"
    schemas = spec["components"]["schemas"]
    for name in ["ForecastSummary", "ForecastSeriesResponse", "ForecastPoint"]:
        assert name in schemas, f"missing schema {name}"
