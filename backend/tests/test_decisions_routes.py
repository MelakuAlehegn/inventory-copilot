"""The decision endpoints are registered with typed schemas (no data load needed)."""

from copilot.api.main import app


def test_decision_routes_and_schemas_registered():
    spec = app.openapi()
    paths = spec["paths"]
    for path in ["/decisions/what-if", "/decisions/compare", "/decisions/pareto", "/decisions/scorecard"]:
        assert path in paths, f"missing route {path}"

    schemas = spec["components"]["schemas"]
    for name in ["ScenarioRequest", "MetricsResponse", "CompareResponse", "ParetoRow", "ScorecardResponse"]:
        assert name in schemas, f"missing schema {name}"
