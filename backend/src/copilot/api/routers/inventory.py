"""Inventory endpoint: grounded reorder recommendations + a simulated current position.

Serves the per-series inventory table (see core/simulation/inventory.py) with optional
status / store / search filters for the inventory view and the dashboard reorder queue.
Auth-gated (internal tool); the table is precomputed, so filtering here is cheap.
"""

from __future__ import annotations

import polars as pl
from fastapi import APIRouter, Depends, Query

from copilot.api.dependencies import get_inventory_table
from copilot.api.schemas.inventory import InventoryItem
from copilot.api.security import get_current_user

router = APIRouter(prefix="/inventory", tags=["inventory"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[InventoryItem])
async def inventory(
    status: str | None = None,
    store: str | None = None,
    search: str | None = None,
    limit: int = Query(default=200, ge=1, le=5000),
    table: pl.DataFrame = Depends(get_inventory_table),
):
    """Per-series recommendations + simulated position, optionally filtered."""
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
    return df.head(limit).to_dicts()
