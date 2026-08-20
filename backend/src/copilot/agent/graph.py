"""The inventory copilot agent, built by hand as a LangGraph StateGraph.

The loop from step 4, now with a grounding referee before any answer escapes:

    START -> agent -> (asked for a tool? -> tools -> back to agent
                       : final answer     -> grounding -> pass  -> END
                                                        -> retry -> back to agent
                                                        -> give up honestly -> END)

- **State** is the shared notebook: the message list (append via `add_messages`) plus a
  small counter for how many grounding retries we've spent.
- **agent** node = the brain (LLM with tools attached).
- **tools** node = the hands (runs whatever the brain asked for).
- **grounding** node = a plain-code referee (see agent/grounding.py): it checks every
  number in the answer against what the tools returned. Pass -> done. Fail -> one do-over,
  then an honest "couldn't verify" message rather than shipping an unverified figure.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Any, TypedDict

from langchain_core.messages import (
    AIMessage,
    AnyMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from copilot.agent.context import CopilotContext
from copilot.agent.grounding import check_grounding, grounded_numbers
from copilot.agent.providers import get_chat_model
from copilot.agent.tools import build_tools

MAX_GROUNDING_RETRIES = 1  # one do-over, then be honest


class AgentState(TypedDict):
    """The shared notebook that flows through the graph."""

    messages: Annotated[list[AnyMessage], add_messages]
    grounding_retries: int
    route: str  # set by the grounding node to steer the fork after it


def _system_prompt(ctx: CopilotContext) -> str:
    """Role + the golden rule, with the real horizon dates filled in from the context."""
    start: date = ctx.actuals["ds"].min()
    end: date = ctx.actuals["ds"].max()
    return (
        "You are an inventory-planning copilot for a retail dataset (M5 'FOODS' category, "
        "all stores). You help people understand inventory decisions by running tools.\n\n"
        "GOLDEN RULE: you never do arithmetic yourself except trivial, obvious combinations "
        "of numbers the tools returned (e.g. subtracting two results for a difference). For "
        "ANY number you report, you must have obtained it from a tool call in this "
        "conversation, or computed it directly from such numbers. Never estimate, guess, or "
        "invent a figure. If the tools can't answer something, say so plainly.\n\n"
        "Setting:\n"
        "- Two policies: 'base_stock' (forecast-driven) and 'naive' (recent-average baseline).\n"
        f"- The simulation replays real demand over the holdout horizon {start} to {end}.\n"
        "- Metrics returned by tools: fill_rate (service level achieved), stockout_units, "
        "stockout_day_rate, avg_on_hand, holding_cost, stockout_cost, ordering_cost, total_cost.\n"
        "- You can also look up an individual item (a series id like 'FOODS_3_090_CA_3') for its "
        "inventory position/recommendation and its demand forecast.\n\n"
        "Levers vs assumptions: when you recommend how to reach a target, separate the two.\n"
        "- Controllable levers the planner can actually set: policy, service_level, lead_time, "
        "review_period. Recommend changes to THESE.\n"
        "- Scenario assumptions describing the world, not a setting: demand_multiplier (a demand "
        "shock), price_multiplier and elasticity. The planner does not 'set' these to hit a target. "
        "If reaching a target depends on one of them, frame it as a condition, e.g. 'if the demand "
        "surge eases back to normal (demand_multiplier 1), then service_level 0.98 reaches 93%', "
        "not 'set demand_multiplier to 1'.\n\n"
        "Scenario snapshot: on the scenarios page the context may carry a 'shown_' snapshot — "
        "the parameters (shown_policy, shown_service_level, shown_lead_time, shown_review_period, "
        "shown_demand_multiplier, shown_price_multiplier, shown_elasticity) and the resulting "
        "metrics (shown_fill_rate, shown_total_cost, shown_stockout_units, and so on) of the "
        "scenario the user has ALREADY RUN and is looking at on screen. When they ask about 'this "
        "scenario' or the current result, explain those shown_ numbers directly — do NOT call "
        "run_what_if again just to reproduce a result you already have. Call a tool only when the "
        "user asks about a DIFFERENT setting than the shown one, or wants something the snapshot "
        "doesn't include (a service-level sweep, a policy comparison, an item lookup). If "
        "sliders_changed_since_run is 'yes', the on-screen numbers came from the shown_ parameters, "
        "not the current slider positions; explain the shown result, and if the user seems to mean "
        "the new slider values, note that they haven't run that yet.\n\n"
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


def _should_continue(state: AgentState) -> str:
    """After the brain speaks: run tools it asked for, else go check the answer."""
    last = state["messages"][-1]
    return "tools" if getattr(last, "tool_calls", None) else "answer"


def _grounding(state: AgentState) -> dict:
    """Referee: verify the answer's numbers; pass, ask for one do-over, or fail honestly."""
    messages = state["messages"]
    answer = message_text(messages[-1])
    result = check_grounding(answer, grounded_numbers(messages[:-1]))
    retries = state.get("grounding_retries", 0)

    if result.ok:
        return {"route": "end"}

    if retries < MAX_GROUNDING_RETRIES:
        orphans = ", ".join(f"{o:g}" for o in result.orphans)
        correction = HumanMessage(
            f"Your previous answer included figures not backed by any tool result: {orphans}. "
            "Answer again using ONLY numbers a tool returned (call tools again if needed), or "
            "numbers you can compute directly from them. Remove anything you cannot verify."
        )
        return {"messages": [correction], "grounding_retries": retries + 1, "route": "retry"}

    fallback = AIMessage(
        "I can't fully verify some of the figures needed for that answer, so I won't guess. "
        "Try rephrasing, or ask about a specific metric I can compute with the tools."
    )
    return {"messages": [fallback], "route": "failed"}


def _route_after_grounding(state: AgentState) -> str:
    return state.get("route", "end")


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

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent)
    graph.add_node("tools", tools_node)
    graph.add_node("grounding", _grounding)
    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", _should_continue, {"tools": "tools", "answer": "grounding"})
    graph.add_edge("tools", "agent")
    graph.add_conditional_edges(
        "grounding", _route_after_grounding, {"retry": "agent", "end": END, "failed": END}
    )
    return graph.compile(checkpointer=checkpointer)
