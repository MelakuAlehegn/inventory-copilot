# Architecture

## Principle: deterministic core, agentic edge
The system is split so that **all decisions are computed by tested, deterministic
code**, and the **LLM only orchestrates and explains**. The agent cannot compute or
invent a number — it calls a tool and cites the tool's output.

```
┌───────────────────────────────────────────────────────────────────┐
│  frontend/  Next.js (Fly.io) — Auth.js (GitHub/Google), streaming   │
│             chat, forecast/policy/simulation dashboards, saved      │
│             scenarios per user                                      │
└───────────────┬─────────────────────────────────────┬─────────────┘
                │ REST / SSE                            │
┌───────────────▼─────────────────────────────────────▼─────────────┐
│  backend/  FastAPI (async, Fly.io)                                  │
│                                                                     │
│  ┌── agent/  (agentic — open-ended only) ─────────────────────────┐ │
│  │  LangGraph state machine                                        │ │
│  │  Tools → forecast · compute_policy · simulate · what_if ·       │ │
│  │          query_data(SQL, guarded) · item_info                   │ │
│  │  Pydantic structured tool I/O    Grounding guardrail            │ │
│  │  LLMProvider protocol → [Ollama | OpenAI-compat: Groq]          │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌── core/  (fixed-sequence — plain deterministic code) ──────────┐ │
│  │  data → features → forecast (LightGBM quantiles)               │ │
│  │       → policy (base-stock) → simulation (rolling replay)      │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  eval/  forecast + decision + agent evaluation harness             │
│  mcp/   (optional) re-exposes core tools over MCP                  │
└──────────┬──────────────────────────────────┬─────────────────────┘
           │                                   │
   ┌───────▼────────┐                 ┌────────▼─────────┐
   │ DuckDB/Parquet │                 │  Neon Postgres   │
   │ (M5 analytics) │                 │ users, scenarios,│
   │                │                 │ agent runs, evals│
   └────────────────┘                 └──────────────────┘

Scheduler (Fly cron machine): advances "simulated today" → daily batch
Observability: Langfuse (LLM traces) + Logfire/OTel (app spans)
```

## Import boundaries (enforced in review/lint)
- `core/` imports **nothing** from `agent/`, `api/`, or `eval/`. It is a pure library.
- `agent/` imports `core/`. Tools are thin wrappers over core functions.
- `api/` imports `agent/` and `core/`.
- `mcp/` imports `core/` (and reuses the same tool definitions as `agent/`).

## Why in-process tools, not MCP, internally
The agent calls core functions in-process (typed Python). MCP would add a process
boundary, serialization, and latency with no benefit for internal wiring. MCP is
provided only as an **optional external server** so other clients (Claude Desktop,
Cursor, etc.) can use the same core tools — reusing the identical tool layer.

## Data split
- **DuckDB/Parquet** — analytical M5 data (embedded, fast, no server).
- **Postgres (Neon)** — application state: users, saved scenarios, agent run logs,
  eval results.
