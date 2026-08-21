"""Inventory endpoint: grounded reorder recommendations + a simulated current position.

Serves the per-series inventory table (see core/simulation/inventory.py) with optional
status / store / search filters for the inventory view and the dashboard reorder queue.
Auth-gated (internal tool); the table is precomputed, so filtering here is cheap.
"""

from __future__ import annotations

from typing import Any

import polars as pl
from fastapi import APIRouter, Depends, Query

from copilot.api.dependencies import get_inventory_table
from copilot.api.schemas.inventory import InventoryItem, InventorySummary
from copilot.api.security import get_current_user

router = APIRouter(
    prefix="/inventory", tags=["inventory"], dependencies=[Depends(get_current_user)]
)


@router.get("/summary", response_model=InventorySummary)
async def inventory_summary(
    table: pl.DataFrame = Depends(get_inventory_table),
) -> InventorySummary:
    """Per-status counts only — cheap, so the sidebar badge / dashboard tiles don't pull rows."""
    counts = dict(table.group_by("status").len().iter_rows())  # {status: n}
    critical = counts.get("critical", 0)
    reorder = counts.get("reorder", 0)
    return InventorySummary(
        total=table.height,
        critical=critical,
        reorder=reorder,
        healthy=counts.get("healthy", 0),
        overstock=counts.get("overstock", 0),
        alert_count=critical + reorder,
    )


@router.get("", response_model=list[InventoryItem])
async def inventory(
    status: str | None = None,
    store: str | None = None,
    search: str | None = None,
    limit: int = Query(default=50, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
    table: pl.DataFrame = Depends(get_inventory_table),
) -> list[dict[str, Any]]:
    """Per-series recommendations + simulated position, optionally filtered and paginated."""
    df = table
    if status:
        df = df.filter(pl.col("status") == status)
    if store:
        df = df.filter(pl.col("store_id") == store)
    if search:
        needle = search.upper()
        df = df.filter(
            pl.col("item_id").str.contains(needle) | pl.col("unique_id").str.contains(needle)
        )
    return df.slice(offset, limit).to_dicts()
