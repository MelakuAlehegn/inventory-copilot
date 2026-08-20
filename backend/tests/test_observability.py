"""Langfuse tracing is optional: with no keys configured it must be a clean no-op."""

import asyncio

from copilot.agent import observability


def test_disabled_without_keys(monkeypatch):
    monkeypatch.setattr(observability.settings, "langfuse_public_key", None)
    monkeypatch.setattr(observability.settings, "langfuse_secret_key", None)

    assert observability.langfuse_enabled() is False
    assert observability.get_callback_handler() is None
    # An empty config spreads harmlessly into a graph invocation.
    assert observability.trace_config(session_id="s", user_id="u", tags=["chat"]) == {}
    # Flushing when disabled does nothing and never raises.
    asyncio.run(observability.flush())


def test_enabled_config_labels_the_trace(monkeypatch):
    monkeypatch.setattr(observability.settings, "langfuse_public_key", "pk-lf-test")
    monkeypatch.setattr(observability.settings, "langfuse_secret_key", "sk-lf-test")
    monkeypatch.setattr(observability.settings, "langfuse_host", "https://cloud.langfuse.com")

    assert observability.langfuse_enabled() is True

    config = observability.trace_config(session_id="sess-1", user_id="user-1", tags=["chat"])
    assert config["callbacks"], "a callback handler should be attached when enabled"
    assert config["metadata"]["langfuse_session_id"] == "sess-1"
    assert config["metadata"]["langfuse_user_id"] == "user-1"
    assert config["metadata"]["langfuse_tags"] == ["chat"]
