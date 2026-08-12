"""Internal tool: every endpoint except health/auth requires a token (no DB needed)."""

from fastapi.testclient import TestClient

from copilot.api.main import app

_client = TestClient(app, raise_server_exceptions=False)


def test_protected_endpoints_reject_anonymous():
    # No Authorization header -> rejected before any DB/compute happens.
    for path in ["/me", "/decisions/pareto", "/analytics/kpis", "/scenarios", "/chat/sessions"]:
        assert _client.get(path).status_code == 401, path


def test_public_endpoints_open():
    assert _client.get("/health").status_code == 200
    # Auth endpoints exist and are not gated (422 = validation, not 401/404).
    assert _client.post("/auth/login", json={}).status_code == 422
