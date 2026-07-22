"""Central configuration, loaded from environment / .env via pydantic-settings.

This is the single source of truth for the LLM provider abstraction, database,
observability, and paths. Import `settings` anywhere; never read os.environ directly.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- LLM provider abstraction ---
    llm_provider: str = Field(default="ollama")  # "ollama" | "groq"
    llm_model: str = Field(default="qwen2.5:7b-instruct")
    ollama_base_url: str = Field(default="http://localhost:11434/v1")
    groq_api_key: str | None = None
    groq_base_url: str = Field(default="https://api.groq.com/openai/v1")

    # --- database ---
    database_url: str = Field(
        default="postgresql+psycopg://copilot:copilot@localhost:5432/copilot"
    )

    # --- observability ---
    langfuse_host: str | None = None
    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    logfire_token: str | None = None

    # --- experiment tracking ---
    mlflow_tracking_uri: str = Field(default="./mlruns")

    # --- paths ---
    data_dir: Path = Field(default=Path("../data"))

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def processed_dir(self) -> Path:
        return self.data_dir / "processed"


settings = Settings()
