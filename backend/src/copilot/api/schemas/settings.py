"""Schemas for the operator settings endpoints (active LLM + Ollama models)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Provider = Literal["gemini", "ollama"]


class OllamaModel(BaseModel):
    name: str
    size: int | None = None  # bytes on disk, when Ollama reports it


class LlmStatusResponse(BaseModel):
    """Everything the settings panel needs to render in one call."""

    provider: str
    model: str
    providers: list[str]
    gemini_configured: bool  # is a Google API key present (else Gemini is unusable)
    ollama_available: bool  # is a local Ollama server reachable
    ollama_models: list[OllamaModel]


class UpdateLlmRequest(BaseModel):
    provider: Provider  # validated against the known providers on input
    model: str = Field(min_length=1)


class LlmSettingsResponse(BaseModel):
    provider: str
    model: str


class PullModelRequest(BaseModel):
    name: str = Field(min_length=1)
