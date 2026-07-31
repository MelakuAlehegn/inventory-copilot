"""The inventory copilot agent, built by hand as a LangGraph StateGraph.

This is the same "think -> call tool -> look -> repeat -> answer" loop the prebuilt
`create_react_agent` gives you, but written out node by node so every piece is visible:

    START -> agent -> (asked for a tool? -> tools -> back to agent : -> END)

- **State** is the shared notebook passed between nodes; here it's just the message list,
  tagged with the `add_messages` reducer so nodes *append* messages instead of replacing.
- The **agent** node is the brain: it calls the LLM (with tools attached).
- The **tools** node is the hands: it runs whatever tools the brain asked for.
- **should_continue** is the fork: loop to tools if the brain requested any, else stop.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Any, TypedDict

from langchain_core.messages import AnyMessage, SystemMessage, ToolMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from copilot.agent.context import CopilotContext
from copilot.agent.providers import get_chat_model
from copilot.agent.tools import build_tools


class AgentState(TypedDict):
    """The shared notebook that flows through the graph. `add_messages` appends."""

    messages: Annotated[list[AnyMessage], add_messages]


def _system_prompt(ctx: CopilotContext) -> str:
    """Role + the golden rule, with the real horizon dates filled in from the context."""
    start: date = ctx.actuals["ds"].min()
    end: date = ctx.actuals["ds"].max()
    return (
        "You are an inventory-planning copilot for a retail dataset (M5 'FOODS' category, "
        "all stores). You help people understand inventory decisions by running tools.\n\n"
        "GOLDEN RULE: you never do arithmetic yourself. For ANY number you report, you must "
        "have obtained it from a tool call in this conversation, and you may only state "
        "numbers that a tool actually returned. Never estimate, round loosely, or invent a "
        "figure. If the tools can't answer something, say so plainly instead of guessing.\n\n"
        "Setting:\n"
        "- Two policies: 'base_stock' (forecast-driven) and 'naive' (recent-average baseline).\n"
        f"- The simulation replays real demand over the holdout horizon {start} to {end}.\n"
        "- Metrics returned by tools: fill_rate (service level achieved), stockout_units, "
        "stockout_day_rate, avg_on_hand, holding_cost, stockout_cost, ordering_cost, total_cost.\n\n"
        "Answer in plain, non-jargon language that a person with no retail background can follow."
    )


def message_text(message: AnyMessage) -> str:
    """Flatten a message's content to plain text.

    Needed because some providers (Gemini via langchain-core 1.x) return `.content` as a
    list of typed blocks rather than a string.
    """
    content = message.content
    if isinstance(content, str):
        return content
    parts: list[str] = []
    for block in content:
        if isinstance(block, dict):
            if block.get("type") == "text":
                parts.append(block.get("text", ""))
        else:
            parts.append(str(block))
    return "".join(parts)


def build_agent(ctx: CopilotContext, model: Any = None, checkpointer: Any = None):
    """Build and compile the copilot agent graph for a loaded data context."""
    model = model or get_chat_model()
    tools = build_tools(ctx)
    model_with_tools = model.bind_tools(tools)
    tools_by_name = {t.name: t for t in tools}
    system_prompt = _system_prompt(ctx)

    def agent(state: AgentState) -> dict:
        """Brain: prepend the system prompt and let the LLM respond."""
        messages = [SystemMessage(system_prompt), *state["messages"]]
        return {"messages": [model_with_tools.invoke(messages)]}

    def tools_node(state: AgentState) -> dict:
        """Hands: run every tool the brain's last message asked for."""
        last = state["messages"][-1]
        outputs: list[ToolMessage] = []
        for call in last.tool_calls:
            result = tools_by_name[call["name"]].invoke(call["args"])
            outputs.append(
                ToolMessage(content=str(result), tool_call_id=call["id"], name=call["name"])
            )
        return {"messages": outputs}

    def should_continue(state: AgentState) -> str:
        """Fork: if the brain requested tools, go run them; otherwise finish."""
        last = state["messages"][-1]
        return "tools" if getattr(last, "tool_calls", None) else "end"

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent)
    graph.add_node("tools", tools_node)
    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
    graph.add_edge("tools", "agent")
    return graph.compile(checkpointer=checkpointer)
