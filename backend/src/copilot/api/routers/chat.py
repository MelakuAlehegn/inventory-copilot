"""Chat endpoints: stream the grounded agent over SSE and serve conversation history.

The conversation is persisted in Postgres (the source of truth for memory); each turn we
replay the prior user/assistant messages as context, run the agent, stream tool steps as
they happen, then emit — and persist — the grounding-verified answer.
"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator, Iterable

from fastapi import APIRouter, Depends, HTTPException, status
from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, SystemMessage
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from copilot.agent import observability
from copilot.agent.graph import message_text
from copilot.api.dependencies import get_agent
from copilot.api.schemas.chat import ChatMessageResponse, ChatRequest, ChatSessionResponse
from copilot.api.security import get_current_user
from copilot.db.models import ChatMessage, ChatSession, User
from copilot.db.session import async_session_maker, get_session

router = APIRouter(prefix="/chat", tags=["chat"])


def context_note(context: dict) -> str:
    """A one-line note telling the agent what the user is currently viewing."""
    return "Context — the user is currently viewing: " + ", ".join(
        f"{k}={v}" for k, v in context.items()
    )


def to_lc_history(rows: Iterable) -> list[AnyMessage]:
    """Replay stored user/assistant text turns as LangChain messages (context for the agent).

    Past tool calls are not replayed — the agent re-runs tools each turn — so only the
    conversational text is reconstructed.
    """
    history: list[AnyMessage] = []
    for row in rows:
        if row.role == "user":
            history.append(HumanMessage(row.content))
        elif row.role == "assistant":
            history.append(AIMessage(row.content))
    return history


def _summarize_tool_result(message: AnyMessage) -> str:
    """A short, single-line preview of a tool's output for the trajectory UI."""
    text = " ".join(str(message.content).split())
    return text[:200] + ("…" if len(text) > 200 else "")


async def _event_stream(
    agent,
    history: list[AnyMessage],
    session_id: uuid.UUID,
    user_id: uuid.UUID,
) -> AsyncIterator[dict]:
    """Run the agent, streaming a staged trajectory (status + tool calls + tool results),
    then the final answer, then persist it."""
    final_text = ""
    trace: list[dict] = []

    # Trace the run in Langfuse when configured; an empty config (tracing off) is harmless.
    config = observability.trace_config(
        session_id=str(session_id), user_id=str(user_id), tags=["chat"]
    )

    yield {"event": "status", "data": json.dumps({"label": "Thinking"})}

    async for chunk in agent.astream({"messages": history}, stream_mode="updates", config=config):
        for node, update in chunk.items():
            if not isinstance(update, dict):
                continue
            messages = update.get("messages", [])

            if node == "agent":
                for m in messages:
                    calls = getattr(m, "tool_calls", None)
                    if calls:
                        yield {"event": "status", "data": json.dumps({"label": "Running tools"})}
                        for c in calls:
                            step = {"name": c["name"], "args": c["args"]}
                            trace.append(step)
                            yield {"event": "tool", "data": json.dumps(step)}
                    elif isinstance(m, AIMessage):
                        final_text = message_text(m)
                        yield {"event": "status", "data": json.dumps({"label": "Verifying the figures"})}

            elif node == "tools":
                for m in messages:
                    yield {"event": "tool_result", "data": json.dumps(
                        {"name": getattr(m, "name", ""), "summary": _summarize_tool_result(m)}
                    )}

            elif node == "grounding":
                route = update.get("route")
                if route == "retry":
                    yield {"event": "status", "data": json.dumps({"label": "Double-checking the numbers"})}
                for m in messages:
                    if isinstance(m, AIMessage):  # the honest "couldn't verify" fallback
                        final_text = message_text(m)

    yield {"event": "status", "data": json.dumps({"label": "Finalizing"})}
    yield {"event": "message", "data": json.dumps({"session_id": str(session_id), "content": final_text})}

    # Persist the assistant turn in its own session (the request session is torn down once
    # the response starts streaming).
    async with async_session_maker() as session:
        session.add(
            ChatMessage(
                session_id=session_id,
                role="assistant",
                content=final_text,
                tool_calls={"trace": trace} if trace else None,
            )
        )
        await session.commit()

    await observability.flush()
    yield {"event": "done", "data": "{}"}


@router.post("/stream")
async def chat_stream(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    agent=Depends(get_agent),
) -> EventSourceResponse:
    """Send a message; stream tool steps and the grounded answer; persist the exchange."""
    if body.session_id is not None:
        chat = await session.get(ChatSession, body.session_id)
        if chat is None or chat.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "chat session not found")
    else:
        page = (body.context or {}).get("page")
        chat = ChatSession(
            user_id=user.id,
            title=body.message[:60],
            page=str(page) if page is not None else None,
        )
        session.add(chat)
        await session.flush()  # assign chat.id

    prior = (
        await session.execute(
            select(ChatMessage).where(ChatMessage.session_id == chat.id).order_by(ChatMessage.id)
        )
    ).scalars().all()
    history = to_lc_history(prior)
    if body.context:
        history.append(SystemMessage(context_note(body.context)))
    history.append(HumanMessage(body.message))

    session.add(ChatMessage(session_id=chat.id, role="user", content=body.message))
    await session.commit()

    return EventSourceResponse(_event_stream(agent, history, chat.id, user.id))


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_sessions(
    page: str | None = None,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List the user's chat sessions, newest first. Filter by origin page when given."""
    query = select(ChatSession).where(ChatSession.user_id == user.id)
    if page:
        query = query.where(ChatSession.page == page)
    query = query.order_by(ChatSession.created_at.desc())
    rows = (await session.execute(query)).scalars().all()
    return rows


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
async def get_messages(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    chat = await session.get(ChatSession, session_id)
    if chat is None or chat.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "chat session not found")
    rows = (
        await session.execute(
            select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.id)
        )
    ).scalars().all()
    return rows


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete one chat session (its messages cascade)."""
    chat = await session.get(ChatSession, session_id)
    if chat is None or chat.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "chat session not found")
    await session.delete(chat)
    await session.commit()


@router.delete("/sessions", status_code=status.HTTP_204_NO_CONTENT)
async def clear_sessions(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete all of the current user's chat sessions (messages cascade via FK)."""
    await session.execute(delete(ChatSession).where(ChatSession.user_id == user.id))
    await session.commit()
