"""LLM provider abstraction.

One function, ``get_chat_model()``, builds the LangChain chat model the agent uses,
based on ``settings.llm_provider``. Gemini (free Google AI Studio key) is wired now;
Ollama (local, open-weight) is a later addition behind the same function, so nothing
else in the agent needs to know which provider is active.
"""

from copilot.agent.providers.factory import get_chat_model

__all__ = ["get_chat_model"]
