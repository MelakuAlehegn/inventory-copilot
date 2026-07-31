"""Deterministic grounding check — the referee. No LLM involved.

Every number in the agent's answer must trace to a real tool result: either it *is* one
of the numbers the tools returned (or that the model passed into a tool, or that the user
asked about), or it is a simple, re-computable combination of them (a difference, sum, or
percentage change). We recompute those combinations here — so "the agent may do simple
arithmetic" holds only when we can verify the arithmetic. Anything else is an "orphan".

A mechanical check like this can't be talked into approving an invented number, which is
exactly why the referee is plain code and not another model.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, ToolMessage

# Matches ints/decimals with optional thousands commas, sign, and trailing percent.
_NUM_RE = re.compile(r"[-+]?\d[\d,]*(?:\.\d+)?%?")
_ABS_TOL = 0.01  # absolute slack, for small values
_REL_TOL = 0.01  # 1% relative slack, for large values (allows minor rounding)


@dataclass
class GroundingResult:
    ok: bool
    orphans: list[float] = field(default_factory=list)


def _content_str(message: AnyMessage) -> str:
    c = message.content
    return c if isinstance(c, str) else str(c)


def _token_value(token: str) -> float | None:
    core = token.replace(",", "").rstrip("%")
    try:
        return float(core)
    except ValueError:
        return None


def _token_candidates(token: str) -> list[float]:
    """A "95%" token can mean 0.95 or 95 — try both. A plain token is just itself."""
    value = _token_value(token)
    if value is None:
        return []
    return [value / 100.0, value] if token.endswith("%") else [value]


def _numbers_in(text: str) -> list[float]:
    out: list[float] = []
    for tok in _NUM_RE.findall(text):
        out.extend(_token_candidates(tok))
    return out


def _is_claim(token: str) -> bool:
    """Only check "real" figures: decimals, percentages, or magnitudes >= 1000.

    Bare small integers ("2 policies", "step 1") are prose, not factual metric claims;
    checking them would cause noisy false failures. Every metric we actually report is a
    decimal, a percentage, or a large count, so this filter keeps the real claims in.
    """
    value = _token_value(token)
    if value is None:
        return False
    return ("." in token) or ("%" in token) or (abs(value) >= 1000)


def _close(a: float, b: float) -> bool:
    return abs(a - b) <= max(_ABS_TOL, _REL_TOL * abs(b))


def _matches_directly(value: float, grounded: list[float]) -> bool:
    return any(_close(value, g) for g in grounded)


def _is_derivable(value: float, operands: list[float]) -> bool:
    """True if `value` is a difference, sum, or percentage change of two grounded numbers."""
    for i, x in enumerate(operands):
        for y in operands[i + 1 :]:
            combos = [x - y, y - x, x + y]
            for denom, num in ((y, x - y), (x, y - x)):
                if denom:
                    combos.append(num / denom)
                    combos.append(num / denom * 100.0)
            if any(_close(value, c) for c in combos):
                return True
    return False


def grounded_numbers(messages: list[AnyMessage]) -> list[float]:
    """Collect every number the answer is allowed to use: tool outputs, the numbers the
    model passed into tools, and the numbers in the user's original question."""
    numbers: list[float] = []
    seen_first_human = False
    for m in messages:
        if isinstance(m, ToolMessage):
            numbers += _numbers_in(_content_str(m))
        elif isinstance(m, HumanMessage):
            if not seen_first_human:  # the real question; skip any injected corrections
                numbers += _numbers_in(_content_str(m))
                seen_first_human = True
        elif isinstance(m, AIMessage):
            for call in getattr(m, "tool_calls", None) or []:
                numbers += _numbers_in(str(call.get("args", {})))
    return numbers


def check_grounding(answer: str, grounded: list[float]) -> GroundingResult:
    """Verify every metric-like number in `answer` against the grounded numbers."""
    orphans: list[float] = []
    for tok in _NUM_RE.findall(answer):
        if not _is_claim(tok):
            continue
        candidates = _token_candidates(tok)
        if any(
            _matches_directly(v, grounded) or _is_derivable(v, grounded) for v in candidates
        ):
            continue
        orphans.append(candidates[-1])
    return GroundingResult(ok=not orphans, orphans=orphans)
