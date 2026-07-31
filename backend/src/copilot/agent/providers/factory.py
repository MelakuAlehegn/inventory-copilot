"""Provider factory: build the one chat model the agent talks to.

Everything in the agent asks *this* function for a model instead of constructing a
provider directly. Switching providers (Gemini now, Ollama later) then becomes a
one-place change that never ripples through the rest of the code.
"""

from __future__ import annotations

from langchain_core.language_models import BaseChatModel

from copilot.config import Settings, settings


def get_chat_model(cfg: Settings = settings, *, temperature: float = 0.0) -> BaseChatModel:
    """Return a ready-to-use LangChain chat model for the configured provider.

    temperature defaults to 0.0: for a copilot that must stick to computed numbers it should
     be least-random, most-repeatable responses.
    """
    provider = cfg.llm_provider.lower()

    if provider == "gemini":
        if not cfg.google_api_key:
            raise RuntimeError(
                "GOOGLE_API_KEY is not set. Add it to backend/.env "
                "(key from https://aistudio.google.com/apikey)."
            )
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=cfg.llm_model,
            google_api_key=cfg.google_api_key,
            temperature=temperature,
        )

    # Ollama seam — going to be added laters.
    raise NotImplementedError(f"LLM provider {provider!r} is not wired up yet.")
