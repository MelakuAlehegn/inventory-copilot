"""Thin async client for a local Ollama server.

Talks to Ollama's REST API over HTTP so the settings endpoints can show which models are
installed, whether the server is reachable, and stream a model download's progress. We use
httpx directly (rather than a heavier client) to keep full control of streaming and timeouts.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

# A quick reachability/list check should fail fast; a model download must not time out.
_PROBE_TIMEOUT = httpx.Timeout(3.0)
_PULL_TIMEOUT = httpx.Timeout(connect=5.0, read=None, write=None, pool=None)


async def is_available(base_url: str) -> bool:
    """True if an Ollama server answers at base_url."""
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=_PROBE_TIMEOUT) as client:
            resp = await client.get("/api/version")
            return resp.status_code == 200
    except httpx.HTTPError:
        return False


async def list_models(base_url: str) -> list[dict[str, Any]]:
    """Return the installed models as ``[{"name", "size"}]`` (empty if unreachable)."""
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=_PROBE_TIMEOUT) as client:
            resp = await client.get("/api/tags")
            resp.raise_for_status()
    except httpx.HTTPError:
        return []
    models = resp.json().get("models", [])
    return [{"name": m.get("name", ""), "size": m.get("size")} for m in models]


async def pull_model(base_url: str, name: str) -> AsyncIterator[dict[str, Any]]:
    """Stream progress while Ollama downloads ``name``.

    Yields the raw progress objects Ollama emits (status, and completed/total byte counts
    while layers download), ending with ``{"status": "success"}``. Errors surface as
    ``{"error": "..."}`` so the caller can relay them to the UI.
    """
    payload = {"model": name, "stream": True}
    async with (
        httpx.AsyncClient(base_url=base_url, timeout=_PULL_TIMEOUT) as client,
        client.stream("POST", "/api/pull", json=payload) as resp,
    ):
        if resp.status_code != 200:
            await resp.aread()
            yield {"error": f"Ollama returned {resp.status_code}: {resp.text}"}
            return
        async for line in resp.aiter_lines():
            if line.strip():
                yield json.loads(line)
