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
    llm_provider: str = Field(default="gemini")  # "gemini" | "ollama"
    llm_model: str = Field(default="gemini-2.5-flash")
    google_api_key: str | None = None  # also read directly by the Google GenAI client
    ollama_base_url: str = Field(default="http://localhost:11434/v1")
    # Optional client-side request pacing (requests/second) for batch jobs that must stay
    # within an API's rate limits. None = unlimited; leave unset for interactive use.
    llm_requests_per_second: float | None = None

    # --- database ---
    database_url: str = Field(default="postgresql+psycopg://copilot:copilot@localhost:5432/copilot")
    # Migrations run against a direct (non-pooled) endpoint on serverless Postgres.
    # Falls back to database_url when unset (e.g. local dev).
    database_migration_url: str | None = None

    # --- API ---
    # Origins allowed to call the API (the frontend). Override via CORS_ORIGINS (JSON list).
    cors_origins: list[str] = Field(default=["http://localhost:3000"])

    # --- Auth ---
    # Shared secret the frontend signs the Bearer JWT with and the backend verifies.
    auth_jwt_secret: str | None = None
    auth_jwt_algorithm: str = Field(default="HS256")

    # --- observability ---
    langfuse_host: str | None = None
    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    logfire_token: str | None = None

    # --- experiment tracking ---
    mlflow_tracking_uri: str = Field(default="sqlite:///mlflow.db")

    # --- paths ---
    data_dir: Path = Field(default=Path("../data"))

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def processed_dir(self) -> Path:
        return self.data_dir / "processed"


settings = Settings()
