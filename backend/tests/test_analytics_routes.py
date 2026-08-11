"""The analytics endpoints are registered with typed schemas (no data load needed)."""

from copilot.api.main import app


def test_analytics_routes_and_schemas_registered():
    spec = app.openapi()
    paths = spec["paths"]
    for path in ["/analytics/kpis", "/analytics/top-series", "/analytics/series/{unique_id}", "/analytics/stores"]:
        assert path in paths, f"missing route {path}"

    schemas = spec["components"]["schemas"]
    for name in ["KpisResponse", "TopSeriesRow", "SeriesDetailResponse", "StoreRow"]:
        assert name in schemas, f"missing schema {name}"
