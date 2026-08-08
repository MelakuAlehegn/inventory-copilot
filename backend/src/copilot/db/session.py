"""Async database engine + session, exposed as a FastAPI dependency.

`pool_pre_ping` checks a connection is alive before use, which matters on serverless
Postgres (Neon) that can pause and drop idle connections.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from copilot.config import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield a request-scoped session; commit/rollback is the caller's responsibility."""
    async with async_session_maker() as session:
        yield session
