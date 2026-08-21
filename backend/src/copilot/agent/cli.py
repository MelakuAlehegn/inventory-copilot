"""A terminal chat for the inventory copilot.

Loads the data once, builds the agent with conversation memory, then loops: read a
question, stream the tool steps as they happen, and print the grounding-verified answer.
Run with:  copilot-chat   (or  python -m copilot.agent.cli)
"""

from __future__ import annotations

import argparse
import sys

from langchain_core.messages import AIMessage

from copilot.agent.context import load_context
from copilot.agent.graph import build_agent, message_text
from copilot.config import settings

try:  # renamed across langgraph versions
    from langgraph.checkpoint.memory import InMemorySaver as MemorySaver
except ImportError:  # pragma: no cover
    from langgraph.checkpoint.memory import MemorySaver

_DIM, _BOLD, _RESET = "\033[2m", "\033[1m", "\033[0m"
_THREAD = {"configurable": {"thread_id": "cli-session"}}
_QUIT = {"exit", "quit", "q", ":q"}


def _answer(agent, question: str, show_steps: bool) -> str:
    """Run one turn; print tool steps as they stream; return the final verified answer."""
    final = ""
    for chunk in agent.stream({"messages": [("user", question)]}, _THREAD, stream_mode="updates"):
        for node, update in chunk.items():
            messages = update.get("messages", []) if isinstance(update, dict) else []
            for m in messages:
                if node == "agent" and getattr(m, "tool_calls", None):
                    if show_steps:
                        for call in m.tool_calls:
                            print(f"{_DIM}  · ran {call['name']}({call['args']}){_RESET}")
                elif isinstance(m, AIMessage):
                    final = message_text(m)  # last answer (agent) or honest fallback (grounding)
    return final


def main() -> None:
    parser = argparse.ArgumentParser(description="Chat with the inventory copilot.")
    parser.add_argument("--quiet", action="store_true", help="hide the tool-step lines")
    args = parser.parse_args()

    print(
        f"{_BOLD}Inventory Copilot{_RESET}  (provider={settings.llm_provider}, "
        f"model={settings.llm_model})"
    )
    print("loading data...", flush=True)
    ctx = load_context()
    agent = build_agent(ctx, checkpointer=MemorySaver())
    print("ready. Ask a question about inventory decisions. Type 'exit' to quit.\n")

    while True:
        try:
            question = input(f"{_BOLD}you>{_RESET} ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nbye.")
            return
        if not question:
            continue
        if question.lower() in _QUIT:
            print("bye.")
            return
        try:
            answer = _answer(agent, question, show_steps=not args.quiet)
        except Exception as e:  # keep the REPL alive on any one bad turn
            print(f"{_DIM}(error: {e}){_RESET}\n", file=sys.stderr)
            continue
        print(f"\n{_BOLD}copilot>{_RESET} {answer}\n")


if __name__ == "__main__":
    main()
