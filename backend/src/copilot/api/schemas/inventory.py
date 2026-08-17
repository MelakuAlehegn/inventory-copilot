"""Schemas for the inventory endpoint."""

from __future__ import annotations

from pydantic import BaseModel


class InventoryItem(BaseModel):
    unique_id: str
    item_id: str
    store_id: str
    current_stock: float  # simulated on-hand at end of holdout
    reorder_point: float
    safety_stock: float
    order_up_to: float
    recommended_order_qty: float
    mean_daily_demand: float
    days_until_stockout: float | None
    status: str  # healthy | reorder | critical | overstock
    unit_price: float | None


class InventorySummary(BaseModel):
    """Per-status counts for the whole inventory table — a few numbers, not the rows.

    Lets the sidebar badge and dashboard tiles avoid pulling the full table.
    """

    total: int
    critical: int
    reorder: int
    healthy: int
    overstock: int
    alert_count: int  # critical + reorder (the "needs attention" total)
