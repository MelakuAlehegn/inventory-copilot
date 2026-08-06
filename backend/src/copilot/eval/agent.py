"""Evaluate the agent against the gold set: tool-selection + grounding metrics.

For each gold question we run the agent once (a fresh, memory-less conversation) and record:
  - which tools it called (distinct),           -> tool-selection accuracy
  - whether the delivered answer is grounded,   -> faithfulness sanity check
  - how many grounding retries it needed,       -> how often the referee had to step in
  - whether it gave up with the honest fallback -> coverage.

Everything here is deterministic (no LLM judging) — the reasoning-quality judge is Unit C.
Run:  copilot-eval [--quick] [--rps R] [--limit N]
"""

from __future__ import annotations

import argparse
import time

import polars as pl
from langchain_core.messages import AIMessage, AnyMessage, ToolMessage

from copilot.agent.context import load_context
from copilot.agent.graph import build_agent, message_text
from copilot.agent.grounding import check_grounding, grounded_numbers
from copilot.agent.providers import get_chat_model
from copilot.eval.agent_gold import GOLD, GoldQuestion
from copilot.eval.judge import judge_answer


def smoke_subset(gold: list[GoldQuestion]) -> list[GoldQuestion]:
    """One question per kind — a fast check that still touches every scenario type."""
    seen: set[str] = set()
    out: list[GoldQuestion] = []
    for g in gold:
        if g.kind not in seen:
            seen.add(g.kind)
            out.append(g)
    return out


def _called_tools(messages: list[AnyMessage]) -> list[str]:
    """Every tool name the agent requested across the conversation."""
    names: list[str] = []
    for m in messages:
        for call in getattr(m, "tool_calls", None) or []:
            names.append(call["name"])
    return names


def _tool_context(messages: list[AnyMessage]) -> str:
    """A text transcript of tool CALLS (with args) and their RESULTS, for the judge.

    Including the args (e.g. service_level=0.95) — not just result numbers — is what lets
    the judge fairly assess claims like "at 95% service".
    """
    lines: list[str] = []
    for m in messages:
        for call in getattr(m, "tool_calls", None) or []:
            lines.append(f"CALL {call['name']}({call['args']})")
        if isinstance(m, ToolMessage):
            lines.append(f"RESULT {m.name}: {m.content}")
    return "\n".join(lines)


def evaluate_question(agent, gold: GoldQuestion, judge_model=None) -> dict:
    """Run one question through the agent and score it (optionally with the LLM-judge)."""
    result = agent.invoke({"messages": [("user", gold.question)]})
    messages = result["messages"]
    answer = message_text(messages[-1])

    called = _called_tools(messages)
    row = {
        "id": gold.id,
        "kind": gold.kind,
        "expected": ",".join(gold.expected_tools) or "(refuse)",
        "called": ",".join(sorted(set(called))) or "(none)",
        "tool_ok": set(called) == set(gold.expected_tools),
        "retries": result.get("grounding_retries", 0),
        "gave_up": result.get("route") == "failed",
        "grounded": check_grounding(answer, grounded_numbers(messages[:-1])).ok,
        "error": False,
    }

    if judge_model is not None:
        try:
            v = judge_answer(gold.question, answer, _tool_context(messages), model=judge_model)
            row["is_refusal"], row["quality"] = v.is_refusal, v.quality
        except Exception:  # a judge failure shouldn't discard the agent result
            row["is_refusal"], row["quality"] = None, None

    return row


def run_eval(agent, gold: list[GoldQuestion], sleep: float = 0.0, limit: int | None = None,
             judge_model=None) -> list[dict]:
    """Score every question, optionally pausing `sleep` seconds between them."""
    items = gold[:limit] if limit else gold
    rows: list[dict] = []
    for i, g in enumerate(items):
        print(f"  [{i + 1}/{len(items)}] {g.id} ...", flush=True)
        try:
            rows.append(evaluate_question(agent, g, judge_model=judge_model))
        except Exception as e:  # one bad call shouldn't abort the whole eval
            rows.append({
                "id": g.id, "kind": g.kind,
                "expected": ",".join(g.expected_tools) or "(refuse)",
                "called": f"ERROR: {e}"[:40], "tool_ok": False,
                "retries": -1, "gave_up": False, "grounded": False, "error": True,
            })
        if sleep and i < len(items) - 1:
            time.sleep(sleep)
    return rows


def summarize(rows: list[dict]) -> dict[str, float]:
    """Metrics over the EVALUABLE rows — API errors are reported separately, not counted
    as model mistakes (a failed API call isn't a wrong answer)."""
    evaluable = [r for r in rows if not r.get("error")]
    m = len(evaluable)
    rate = lambda pred: (sum(1 for r in evaluable if pred(r)) / m) if m else 0.0  # noqa: E731
    out = {
        "n": len(rows),
        "errors": len(rows) - m,
        "evaluable": m,
        "tool_selection_accuracy": rate(lambda r: r["tool_ok"]),
        "delivered_grounded_rate": rate(lambda r: r["grounded"]),
        "first_pass_grounded_rate": rate(lambda r: r["retries"] == 0 and not r["gave_up"]),
        "retry_rate": rate(lambda r: r["retries"] > 0),
        "fallback_rate": rate(lambda r: r["gave_up"]),
    }

    # Judge metrics, only if the judge ran.
    judged = [r for r in evaluable if r.get("quality") is not None]
    if judged:
        j = len(judged)
        # Refusal is correct when the answer declines exactly on the out-of-scope questions.
        out["refusal_accuracy"] = sum(
            1 for r in judged if (r["kind"] == "refuse") == r["is_refusal"]
        ) / j
        out["avg_quality"] = sum(r["quality"] for r in judged) / j
        out["quality_pass_rate"] = sum(1 for r in judged if r["quality"] >= 4) / j

    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate the agent against the gold set.")
    parser.add_argument("--quick", action="store_true", help="one question per kind (fast smoke test)")
    parser.add_argument("--judge", action="store_true", help="also run the LLM-judge (extra model calls)")
    parser.add_argument("--rps", type=float, default=None, help="cap requests/second for a gentle batch run")
    parser.add_argument("--sleep", type=float, default=0.0, help="seconds to pause between questions")
    parser.add_argument("--limit", type=int, default=None, help="only the first N questions")
    args = parser.parse_args()

    print("loading data + building agent...")
    ctx = load_context()
    model = get_chat_model(rate_limit_rps=args.rps)
    agent = build_agent(ctx, model=model)  # no checkpointer: each question is independent
    judge_model = model if args.judge else None

    questions = smoke_subset(GOLD) if args.quick else GOLD
    print(f"running eval ({len(questions)} questions{', with judge' if args.judge else ''}):")
    rows = run_eval(agent, questions, sleep=args.sleep, limit=args.limit, judge_model=judge_model)

    with pl.Config(tbl_rows=100, tbl_width_chars=140, fmt_str_lengths=60):
        print("\n=== per question ===")
        print(pl.DataFrame(rows))

    print("\n=== summary ===")
    for k, v in summarize(rows).items():
        print(f"  {k:26} {v:.3f}" if isinstance(v, float) else f"  {k:26} {v}")


if __name__ == "__main__":
    main()
