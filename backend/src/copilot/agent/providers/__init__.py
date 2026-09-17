"""LLM provider abstraction.

One function, ``get_chat_model()``, builds the LangChain chat model the agent uses,
based on ``settings.llm_provider``. Gemini (cloud API key) and Ollama (local,
open-weight, on-device) are both wired behind the same function, so nothing else in
the agent needs to know which provider is active.
"""

from copilot.agent.providers.factory import get_chat_model

__all__ = ["get_chat_model"]
