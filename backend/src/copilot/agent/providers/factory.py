"""Provider factory: build the one chat model the agent talks to.

Everything in the agent asks *this* function for a model instead of constructing a
provider directly. Switching providers (Gemini now, Ollama later) then becomes a
one-place change that never ripples through the rest of the code.
"""

from __future__ import annotations

from langchain_core.language_models import BaseChatModel
from langchain_core.rate_limiters import InMemoryRateLimiter

from copilot.config import Settings, settings


def get_chat_model(
    cfg: Settings = settings,
    *,
    temperature: float = 0.0,
    rate_limit_rps: float | None = None,
) -> BaseChatModel:
    """Return a ready-to-use LangChain chat model for the configured provider.

    temperature defaults to 0.0 so a copilot that must stick to computed numbers gives the
    least-random, most-repeatable responses.

    rate_limit_rps optionally paces requests (requests/second) for batch workloads; it
    overrides ``settings.llm_requests_per_second``. Both default to None (no pacing), so
    interactive latency is never affected unless pacing is explicitly requested.
    """
    provider = cfg.llm_provider.lower()

    if provider == "gemini":
        if not cfg.google_api_key:
            raise RuntimeError(
                "GOOGLE_API_KEY is not set. Add it to backend/.env "
                "(key from https://aistudio.google.com/apikey)."
            )
        from langchain_google_genai import ChatGoogleGenerativeAI

        rps = rate_limit_rps if rate_limit_rps is not None else cfg.llm_requests_per_second
        rate_limiter = (
            InMemoryRateLimiter(
                requests_per_second=rps, check_every_n_seconds=0.1, max_bucket_size=2
            )
            if rps
            else None
        )
        return ChatGoogleGenerativeAI(
            model=cfg.llm_model,
            google_api_key=cfg.google_api_key,
            temperature=temperature,
            rate_limiter=rate_limiter,
            max_retries=5,
        )

    # Ollama seam — to be added later.
    raise NotImplementedError(f"LLM provider {provider!r} is not wired up yet.")
