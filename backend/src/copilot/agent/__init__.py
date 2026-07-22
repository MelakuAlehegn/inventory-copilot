"""Agentic orchestration layer (open-ended, user-driven only).

A LangGraph state machine that plans which core tools to call, loops on results,
and answers in plain language with computed numbers cited. It cannot compute or
invent decisions — every tool wraps a deterministic core function, and the
grounding guardrail asserts each number in the answer traces to a tool output.
Imports copilot.core; never imported by it.
"""
