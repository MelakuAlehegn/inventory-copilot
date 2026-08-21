"""Gold questions for evaluating the agent.

Each item pairs a natural-language question with the tool(s) we expect the agent to call
(the yardstick for tool-selection accuracy) and a `kind` label. An empty `expected_tools`
means the question is out of scope and the agent should REFUSE (call no tools).

Deliberately small and hand-written — a trustworthy yardstick beats a big noisy one. Grow
it over time; the runner and metrics don't care how many items there are.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GoldQuestion:
    id: str
    question: str
    expected_tools: tuple[str, ...]  # distinct tools we expect; () = should refuse
    kind: str  # compare | what_if | pareto | query | refuse


GOLD: list[GoldQuestion] = [
    # --- policy comparison ---
    GoldQuestion(
        "cmp-95",
        "Does the forecast-driven policy beat the naive baseline at 95% service?",
        ("compare_policies",),
        "compare",
    ),
    GoldQuestion(
        "cmp-98-cost",
        "At a 98% service level, which policy has the lower total cost, forecast or naive?",
        ("compare_policies",),
        "compare",
    ),
    # --- single-scenario what-ifs ---
    GoldQuestion(
        "wif-demand-25",
        "What happens to the fill rate if demand runs 25% higher than we forecast?",
        ("run_what_if",),
        "what_if",
    ),
    GoldQuestion(
        "wif-leadtime",
        "If our supplier's lead time doubles to 14 days, how much more stock do we hold?",
        ("run_what_if",),
        "what_if",
    ),
    GoldQuestion(
        "wif-service-jump",
        "How much extra inventory do we need to go from 95% to 99% service?",
        ("run_what_if",),
        "what_if",
    ),
    GoldQuestion(
        "wif-promo-week",
        "If a promotion doubles demand for a single week, how bad do stockouts get?",
        ("run_what_if",),
        "what_if",
    ),
    GoldQuestion(
        "wif-price-elastic",
        "If we cut price 10% and that lifts demand about 20%, what happens to stockouts?",
        ("run_what_if",),
        "what_if",
    ),
    # --- service-vs-cost sweep ---
    GoldQuestion(
        "par-tradeoff",
        "Show me the service-versus-cost trade-off across a range of service levels.",
        ("get_pareto_curve",),
        "pareto",
    ),
    GoldQuestion(
        "par-always-cheaper",
        "Across service targets, does the forecast policy always cost less than naive?",
        ("get_pareto_curve",),
        "pareto",
    ),
    # --- recorded-data queries (historical sales/prices/events) ---
    GoldQuestion(
        "qry-top-store-units",
        "Which store sold the most units in total across the whole history?",
        ("query_data",),
        "query",
    ),
    GoldQuestion(
        "qry-top-items-revenue",
        "What are the five highest-revenue items overall?",
        ("query_data",),
        "query",
    ),
    GoldQuestion(
        "qry-snap-effect",
        "Are average daily units sold higher on SNAP benefit days than on non-SNAP days?",
        ("query_data",),
        "query",
    ),
    GoldQuestion(
        "qry-event-effect",
        "How do average units sold on calendar-event days compare with normal days?",
        ("query_data",),
        "query",
    ),
    # --- out of scope: should refuse (no tools) ---
    GoldQuestion(
        "ref-warehouse",
        "Should we open a second warehouse?",
        (),
        "refuse",
    ),
    GoldQuestion(
        "ref-staffing",
        "Can you help me schedule staff for the holiday season?",
        (),
        "refuse",
    ),
    GoldQuestion(
        "ref-weather",
        "What will the weather be next month and how will it change sales?",
        (),
        "refuse",
    ),
]
