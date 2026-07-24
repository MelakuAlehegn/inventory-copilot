"""Optional MCP server (external interoperability only).

Re-exposes the deterministic core tools (forecast, policy, simulate, what-if,
query) over the Model Context Protocol so external clients (Claude Desktop, Cursor,
etc.) can use them. Reuses the same tool definitions as copilot.agent. This is NOT
used for the agent's internal tool calls, which stay in-process. Requires the `mcp`
optional dependency.
"""
