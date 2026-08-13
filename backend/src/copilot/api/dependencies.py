"""Shared FastAPI providers: the loaded data context and the agent.

Both are expensive to build (the context reads the processed Parquet; the agent adds the
LLM + tools), so each is created lazily on first use and reused for the process lifetime.
Lazy — rather than at import/startup — keeps endpoints that don't need them (health, auth)
working in environments without data or an LLM key. The agent reuses the one context.
"""

from __future__ import annotations

import threading

import polars as pl

from copilot.agent.context import CopilotContext, load_context
from copilot.agent.graph import build_agent
from copilot.core.simulation.inventory import inventory_table

_context: CopilotContext | None = None
_agent = None
_inventory: pl.DataFrame | None = None
_lock = threading.Lock()


def get_context() -> CopilotContext:
    """The singleton data context (forecast, history, actuals, prices, cutoff)."""
    global _context
    if _context is None:
        with _lock:
            if _context is None:
                _context = load_context()
    return _context


def get_agent():
    """The singleton compiled agent, built on the shared context on first call."""
    global _agent
    if _agent is None:
        ctx = get_context()  # ensure context is loaded (acquires the lock itself)
        with _lock:
            if _agent is None:
                _agent = build_agent(ctx)
    return _agent


def get_inventory_table() -> pl.DataFrame:
    """The per-series inventory table, computed once (default policy) and reused."""
    global _inventory
    if _inventory is None:
        ctx = get_context()
        with _lock:
            if _inventory is None:
                _inventory = inventory_table(
                    ctx.forecast, ctx.history, ctx.actuals, ctx.prices, ctx.cutoff
                )
    return _inventory
