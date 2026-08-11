"""Saved-scenario CRUD routes + schemas are registered (no DB needed)."""

from copilot.api.main import app


def test_scenario_routes_and_schemas_registered():
    spec = app.openapi()
    paths = spec["paths"]
    assert {"post", "get"} <= set(paths["/scenarios"])
    assert {"get", "patch", "delete"} <= set(paths["/scenarios/{scenario_id}"])

    schemas = spec["components"]["schemas"]
    for name in ["ScenarioCreate", "ScenarioUpdate", "SavedScenarioResponse"]:
        assert name in schemas, f"missing schema {name}"
