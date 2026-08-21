"""Application data model: users, saved scenarios, and chat history.

Auth lives in the frontend (Auth.js + JWT), so there are no session/account tables here —
the backend only keeps a light ``users`` row (keyed by the OAuth subject) that its own
tables reference for per-user ownership.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ForeignKey, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from copilot.db.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    # Identity subject: the OAuth "sub" for Google users, or "credentials:<uuid>" for
    # email/password users. Stable per identity.
    id: Mapped[str] = mapped_column(primary_key=True)
    email: Mapped[str | None] = mapped_column(unique=True, index=True)
    name: Mapped[str | None] = mapped_column(nullable=True)
    # Set only for email/password users; None for OAuth users.
    password_hash: Mapped[str | None] = mapped_column(nullable=True)

    scenarios: Mapped[list[SavedScenario]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    chats: Mapped[list[ChatSession]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class SavedScenario(Base, TimestampMixin):
    __tablename__ = "saved_scenarios"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str]
    # The what-if knob values (a Scenario's fields) as JSON.
    params: Mapped[dict[str, Any]] = mapped_column(JSONB)

    user: Mapped[User] = relationship(back_populates="scenarios")


class ChatSession(Base, TimestampMixin):
    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str | None]
    page: Mapped[str | None] = mapped_column(index=True)  # origin page (dashboard, scenarios, ...)

    messages: Mapped[list[ChatMessage]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.id"
    )
    user: Mapped[User] = relationship(back_populates="chats")


class ChatMessage(Base, TimestampMixin):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)  # autoincrement; also orders the thread
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str]  # "user" | "assistant" | "tool"
    content: Mapped[str] = mapped_column(Text)
    # Optional trace of the tools the agent ran for this message (name + args + result).
    tool_calls: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    session: Mapped[ChatSession] = relationship(back_populates="messages")
