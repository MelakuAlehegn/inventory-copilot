"""Shared FastAPI providers that aren't auth or DB session.

The agent (with its loaded data context and tools) is expensive to build, so it is created
lazily on first use and reused for the process lifetime. Building it lazily — rather than at
import/startup — keeps endpoints that don't need it (health, auth) working in environments
without data or an LLM key.
"""

from __future__ import annotations

import threading
from typing import Any

from copilot.agent.context import load_context
from copilot.agent.graph import build_agent

_agent: Any = None
_lock = threading.Lock()


def get_agent() -> Any:
    """Return the singleton compiled agent, building it (load context + tools) on first call."""
    global _agent
    if _agent is None:
        with _lock:
            if _agent is None:
                _agent = build_agent(load_context())
    return _agent
