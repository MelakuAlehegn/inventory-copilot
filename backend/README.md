# Backend

Python home for the deterministic core, the agent, the API, the eval harness, and
the optional MCP server. Managed with **uv** (src layout).

```
src/copilot/
├── config.py         # pydantic-settings: env-driven config (LLM provider, DB, obs)
├── core/             # DETERMINISTIC core — pure library, no web/agent imports
│   ├── data/         # M5 ingestion + feature engineering (Polars, DuckDB)
│   ├── forecast/     # global LightGBM quantile model (mlforecast)
│   ├── policy/       # periodic-review base-stock policy + naive baseline
│   └── simulation/   # rolling replay engine + cost/stockout metrics
├── agent/            # AGENTIC layer — open-ended only
│   ├── providers/    # LLMProvider protocol: Ollama + OpenAI-compatible (Groq)
│   ├── tools.py      # thin Pydantic-typed wrappers over core functions
│   ├── graph.py      # LangGraph state machine
│   └── guardrails.py # grounding check: every number must trace to a tool output
├── api/              # FastAPI app, routes, schemas, auth glue, SSE streaming
├── eval/             # forecast + decision + agent evaluation harness
├── mcp/              # OPTIONAL: re-expose core tools over MCP
└── pipelines/        # CLI entrypoints: download, build_features, train, daily batch
```

## Import boundary (the core stays pure)
`core/` must not import from `agent/`, `api/`, `eval/`, or `mcp/`. Dependency
direction is `api → agent → core` and `mcp → core`.

## Common tasks
```bash
make install     # uv sync (deps + dev + mcp extras)
make train       # train the forecaster
make backtest    # forecast eval (WRMSSE + pinball)
make simulate    # decision eval (policy vs baseline)
make api         # run FastAPI dev server
make check       # lint + typecheck + test (via top-level make)
```
