"""Optional Langfuse tracing for agent runs.

When Langfuse credentials are configured, every agent run can be traced (its steps, tool
calls, token usage, latency and cost) by attaching a LangChain callback handler to the
graph invocation. When they are absent - e.g. local dev with no Langfuse account - the
helpers no-op and the agent runs untraced, so nothing here is required to run the app.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from langchain_core.runnables import RunnableConfig

from copilot.config import settings

if TYPE_CHECKING:
    from langfuse.langchain import CallbackHandler

# Whether we have already initialized the Langfuse client this process (idempotent).
_client_ready = False


def langfuse_enabled() -> bool:
    """True only when both Langfuse keys are set - our signal that tracing is wanted."""
    return bool(settings.langfuse_public_key and settings.langfuse_secret_key)


def _ensure_client() -> None:
    """Initialize the process-wide Langfuse client once from settings.

    The LangChain callback handler looks up this client; creating it here (rather than from
    ambient env vars) keeps all configuration flowing through `settings`.
    """
    global _client_ready
    if _client_ready:
        return
    from langfuse import Langfuse

    Langfuse(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=settings.langfuse_host or "https://cloud.langfuse.com",
    )
    _client_ready = True


def get_callback_handler() -> CallbackHandler | None:
    """A fresh LangChain callback handler for one agent run, or None if tracing is off.

    A new handler per run keeps each run's tracking state isolated. Returning None when
    Langfuse is not configured lets callers pass it straight into the run config unconditionally.
    """
    if not langfuse_enabled():
        return None
    _ensure_client()
    from langfuse.langchain import CallbackHandler

    return CallbackHandler(public_key=settings.langfuse_public_key)


def trace_config(
    *,
    session_id: str | None = None,
    user_id: str | None = None,
    tags: list[str] | None = None,
) -> RunnableConfig:
    """Build the LangChain run config that attaches the tracer and labels the trace.

    Returns an empty dict when tracing is off, so it can always be spread into an invocation.
    Langfuse reads the `langfuse_*` metadata keys to group traces by chat session and user.
    """
    handler = get_callback_handler()
    if handler is None:
        return {}
    metadata: dict[str, Any] = {}
    if session_id is not None:
        metadata["langfuse_session_id"] = session_id
    if user_id is not None:
        metadata["langfuse_user_id"] = user_id
    if tags:
        metadata["langfuse_tags"] = tags
    return {"callbacks": [handler], "metadata": metadata}


async def flush() -> None:
    """Best-effort flush of buffered traces without blocking the event loop.

    The client batches spans and flushes on an interval; we nudge it after a run so traces
    show up promptly. Runs the blocking network flush in a worker thread.
    """
    if not (_client_ready and langfuse_enabled()):
        return
    import asyncio

    from langfuse import get_client

    await asyncio.to_thread(get_client().flush)
