"""Tests for the deterministic grounding checker."""

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from copilot.agent.grounding import check_grounding, grounded_numbers


def test_direct_match_passes():
    result = check_grounding("Fill is 0.9315 for base and 0.9229 for naive.", [0.9315, 0.9229])
    assert result.ok
    assert result.orphans == []


def test_percent_is_matched_against_fraction():
    # "95%" should verify against the fraction 0.95 that a tool used.
    assert check_grounding("A target of 95% was used.", [0.95]).ok


def test_verifiable_difference_passes():
    # 56992.2 - 37317.6 = 19674.6 — a difference of two grounded numbers.
    assert check_grounding("Stockouts drop by 19,674.6 units.", [56992.2, 37317.6]).ok


def test_invented_number_is_orphaned():
    result = check_grounding("You'd save 12,345.6 dollars.", [56992.2, 37317.6])
    assert not result.ok
    assert any(abs(o - 12345.6) < 0.1 for o in result.orphans)


def test_bare_small_integers_are_ignored_as_prose():
    # "2 policies" / "step 1" must not trip the checker.
    assert check_grounding("There are 2 policies and 1 baseline.", []).ok


def test_grounded_numbers_uses_tools_inputs_and_first_question_only():
    messages = [
        HumanMessage("Raise service from 95% to 99%."),
        AIMessage(
            content="",
            tool_calls=[{"name": "run_what_if", "args": {"service_level": 0.99}, "id": "1"}],
        ),
        ToolMessage(content="{'fill_rate': 0.9552}", tool_call_id="1", name="run_what_if"),
        HumanMessage("Correction: 8888.0 was not from a tool."),  # injected -> must be ignored
    ]
    nums = grounded_numbers(messages)
    assert any(abs(n - 0.9552) < 1e-9 for n in nums)  # tool output
    assert any(abs(n - 0.99) < 1e-9 for n in nums)  # tool input
    assert any(abs(n - 0.95) < 1e-9 for n in nums)  # first question (95% -> 0.95)
    assert all(abs(n - 8888.0) > 1e-6 for n in nums)  # injected correction excluded
