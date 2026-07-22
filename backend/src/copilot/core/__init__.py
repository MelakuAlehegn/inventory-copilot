"""Deterministic analytical core.

Pure library: data -> features -> forecast -> policy -> simulation. Tested,
reproducible, no LLM. MUST NOT import from copilot.agent, copilot.api,
copilot.eval, or copilot.mcp — dependency direction points inward only.
"""
