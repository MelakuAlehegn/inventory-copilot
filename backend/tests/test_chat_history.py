"""Test the stored-conversation -> LangChain history replay (pure, no DB)."""

from types import SimpleNamespace

from langchain_core.messages import AIMessage, HumanMessage

from copilot.api.routers.chat import to_lc_history


def test_replays_user_and_assistant_turns_in_order():
    rows = [
        SimpleNamespace(role="user", content="hi"),
        SimpleNamespace(role="assistant", content="hello"),
        SimpleNamespace(role="user", content="thanks"),
    ]
    history = to_lc_history(rows)
    assert [type(m) for m in history] == [HumanMessage, AIMessage, HumanMessage]
    assert [m.content for m in history] == ["hi", "hello", "thanks"]


def test_skips_non_conversational_rows():
    rows = [
        SimpleNamespace(role="user", content="q"),
        SimpleNamespace(role="tool", content="{...}"),  # not replayed as context
        SimpleNamespace(role="assistant", content="a"),
    ]
    history = to_lc_history(rows)
    assert [m.content for m in history] == ["q", "a"]
