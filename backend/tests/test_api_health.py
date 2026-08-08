"""Smoke test for the API skeleton."""

from fastapi.testclient import TestClient

from copilot.api.main import app


def test_health_ok():
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "inventory-copilot"
