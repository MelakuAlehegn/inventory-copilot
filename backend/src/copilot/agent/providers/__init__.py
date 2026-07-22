"""LLM provider abstraction.

A thin `LLMProvider` protocol with OpenAI-compatible implementations for Ollama
(local dev, Qwen2.5) and Groq (prod, Llama-3.3-70B). Both speak the OpenAI API,
so tool-calling and structured output share one code path; the active provider is
chosen from settings. This proves open-weight serving portability across families.
"""
