"""Provider factory: build the one chat model the agent talks to.

Everything in the agent asks *this* function for a model instead of constructing a
provider directly. Switching providers (Gemini in the cloud, Ollama on-device) is
then a one-place change that never ripples through the rest of the code.
"""

from __future__ import annotations

from langchain_core.language_models import BaseChatModel
from langchain_core.rate_limiters import InMemoryRateLimiter

from copilot.config import Settings, settings


def _rate_limiter(cfg: Settings, rate_limit_rps: float | None) -> InMemoryRateLimiter | None:
    """Build an optional request pacer shared by every provider branch.

    rate_limit_rps overrides ``settings.llm_requests_per_second``; when both are None
    there is no pacing, so interactive latency is untouched.
    """
    rps = rate_limit_rps if rate_limit_rps is not None else cfg.llm_requests_per_second
    if not rps:
        return None
    return InMemoryRateLimiter(
        requests_per_second=rps, check_every_n_seconds=0.1, max_bucket_size=2
    )


def get_chat_model(
    cfg: Settings = settings,
    *,
    provider: str | None = None,
    model: str | None = None,
    temperature: float = 0.0,
    rate_limit_rps: float | None = None,
) -> BaseChatModel:
    """Return a ready-to-use LangChain chat model for the configured provider.

    provider and model override the env defaults (``settings.llm_provider`` /
    ``settings.llm_model``) so a caller can build the model chosen at runtime (from the
    DB) instead of only the one baked into the environment.

    temperature defaults to 0.0 so a copilot that must stick to computed numbers gives the
    least-random, most-repeatable responses.

    rate_limit_rps optionally paces requests (requests/second) for batch workloads; it
    overrides ``settings.llm_requests_per_second``. Both default to None (no pacing), so
    interactive latency is never affected unless pacing is explicitly requested.
    """
    provider = (provider or cfg.llm_provider).lower()
    model_name = model or cfg.llm_model
    rate_limiter = _rate_limiter(cfg, rate_limit_rps)

    if provider == "gemini":
        if not cfg.google_api_key:
            raise RuntimeError(
                "GOOGLE_API_KEY is not set. Add it to backend/.env "
                "(key from https://aistudio.google.com/apikey)."
            )
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=cfg.google_api_key,
            temperature=temperature,
            rate_limiter=rate_limiter,
            max_retries=5,
        )

    if provider == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(
            model=model_name,
            base_url=cfg.ollama_base_url,
            temperature=temperature,
            rate_limiter=rate_limiter,
        )

    raise RuntimeError(
        f"Unknown LLM provider {provider!r}. Set LLM_PROVIDER to 'gemini' or 'ollama'."
    )
