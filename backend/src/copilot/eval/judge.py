"""LLM-as-judge: a secondary, softer check of answer quality and refusal appropriateness.

The deterministic grounding check (agent/grounding.py) is the primary, un-gameable
guarantee about numbers. This judge covers what code can't easily see: is the answer a
sensible, correct response to the question given the tool results — and, for out-of-scope
questions, did it properly DECLINE instead of fabricating one?

It is advisory. The judge only grades; it never produces numbers the user sees.

`copilot-judge-test` runs a tiny self-test on canned examples (a few model calls) so the
judge can be validated without running the whole agent over the full gold set.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from copilot.agent.providers import get_chat_model

_JUDGE_SYSTEM = (
    "You are a strict evaluator of an inventory assistant's answers. You are given the "
    "user's QUESTION, the TOOL RESULTS that were available, and the assistant's ANSWER.\n"
    "Judge ONLY against the provided tool results and the question — do not use outside "
    "knowledge and do not compute your own figures.\n"
    "- is_refusal: true if the ANSWER declines / says it cannot answer or lacks the "
    "tools or data, rather than giving a substantive answer.\n"
    "- quality (1-5): how correct and sensible the answer is for the question given the "
    "tool results. If the question is outside the tools' scope and the assistant correctly "
    "declined, that is the RIGHT behavior — rate 5. If it fabricated an answer to an "
    "out-of-scope question, rate low.\n"
    "- reason: one short sentence."
)


class Verdict(BaseModel):
    """A judge's assessment of one answer."""

    is_refusal: bool = Field(description="answer declines/says it can't, vs. answers substantively")
    quality: int = Field(
        ge=1, le=5, description="1-5 correctness/sensibleness given the tool results"
    )
    reason: str = Field(description="one short sentence justifying the rating")


def judge_answer(question: str, answer: str, tool_context: str = "", model=None) -> Verdict:
    """Ask the judge model to assess one answer; returns a structured Verdict."""
    judge = (model or get_chat_model()).with_structured_output(Verdict)
    payload = (
        f"QUESTION:\n{question}\n\n"
        f"TOOL RESULTS:\n{tool_context or '(no tools were used)'}\n\n"
        f"ASSISTANT ANSWER:\n{answer}"
    )
    return judge.invoke([SystemMessage(_JUDGE_SYSTEM), HumanMessage(payload)])


# Canned cases so the judge can be validated cheaply, without running the full agent.
_SELFTEST = [
    {
        "name": "proper-refusal",
        "question": "Should we open a second warehouse?",
        "tool_context": "",
        "answer": "I can't answer that — my tools don't cover warehouse locations or costs.",
        "expect_refusal": True,
        "expect_good": True,
    },
    {
        "name": "good-grounded-answer",
        "question": "Does the forecast policy beat naive at 95% service?",
        "tool_context": "compare_policies -> base_stock fill_rate 0.9315; naive fill_rate 0.9229",
        "answer": "Yes. The forecast policy's fill rate is 0.9315 versus 0.9229 for naive.",
        "expect_refusal": False,
        "expect_good": True,
    },
    {
        "name": "fabricated-nonrefusal",
        "question": "What will the weather be next month and how will it change sales?",
        "tool_context": "",
        "answer": "It will be mostly sunny, which should lift sales by about 10%.",
        "expect_refusal": False,
        "expect_good": False,  # should have declined; instead it made something up
    },
]


def main() -> None:
    model = get_chat_model()
    print("judge self-test:\n")
    for case in _SELFTEST:
        v = judge_answer(case["question"], case["answer"], case["tool_context"], model=model)
        refusal_ok = v.is_refusal == case["expect_refusal"]
        good_ok = (v.quality >= 4) == case["expect_good"]
        mark = "OK " if (refusal_ok and good_ok) else "?? "
        print(f"[{mark}] {case['name']}")
        print(
            f"       is_refusal={v.is_refusal} (expected {case['expect_refusal']})  "
            f"quality={v.quality} (expected {'high' if case['expect_good'] else 'low'})"
        )
        print(f"       reason: {v.reason}\n")


if __name__ == "__main__":
    main()
