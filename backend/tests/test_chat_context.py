"""Chat context note formatting + request schema (no DB/LLM)."""

from copilot.api.routers.chat import context_note
from copilot.api.schemas.chat import ChatRequest


def test_context_note_formats_view():
    note = context_note({"page": "inventory", "item": "FOODS_3_090_CA_3"})
    assert "inventory" in note and "FOODS_3_090_CA_3" in note
    assert note.startswith("Context")


def test_chat_request_accepts_optional_context():
    assert ChatRequest(message="hi").context is None  # optional
    req = ChatRequest(message="why is this critical?", context={"item": "FOODS_3_090_CA_3"})
    assert req.context == {"item": "FOODS_3_090_CA_3"}
