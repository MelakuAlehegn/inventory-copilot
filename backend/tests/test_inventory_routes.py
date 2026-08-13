"""Inventory endpoint registered with a typed schema (no data load needed)."""

from copilot.api.main import app


def test_inventory_route_and_schema_registered():
    spec = app.openapi()
    assert "/inventory" in spec["paths"]
    assert "get" in spec["paths"]["/inventory"]
    assert "InventoryItem" in spec["components"]["schemas"]
