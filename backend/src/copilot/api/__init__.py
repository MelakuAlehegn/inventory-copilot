"""FastAPI application layer.

Async HTTP + SSE endpoints for the chat agent, forecast/policy/simulation views,
and saved scenarios. Handles auth glue (sessions from Auth.js), request validation
(Pydantic), rate limiting, and LLM cost caps. Imports copilot.agent and copilot.core.
"""
