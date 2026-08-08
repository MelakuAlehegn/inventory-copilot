"""Alembic environment.

Uses a synchronous engine for migrations (simplest and most reliable) even though the app
runs async. The URL comes from application settings — the migration URL if set (a direct,
non-pooled endpoint on serverless Postgres), otherwise the normal database URL.
"""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from copilot.config import settings
from copilot.db.base import Base
import copilot.db.models  # noqa: F401  (import registers the tables on Base.metadata)

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
_URL = settings.database_migration_url or settings.database_url


def run_migrations_offline() -> None:
    context.configure(
        url=_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_URL, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata, compare_type=True
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
