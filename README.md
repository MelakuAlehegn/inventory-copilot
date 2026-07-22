# Retail Demand & Inventory Copilot

An AI copilot that forecasts retail demand, recommends inventory decisions
(reorder point, safety stock, order-up-to level), runs what-if simulations, and
uses a **grounded LLM agent** to explain its reasoning — with numbers it actually
computed, never invented.

> **Design stance:** a **deterministic analytical core** (forecast → policy →
> simulate, as tested plain code) with an **agentic orchestration layer** on top.
> The agent only calls tools and cites their outputs; it cannot fabricate decisions.

See [docs/architecture.md](docs/architecture.md) for the architecture and layering.

## Repository layout

```
inventory-copilot/
├── backend/        # Python: core library, agent, API, eval, (optional) MCP server
├── frontend/       # Next.js app: auth, streaming chat, dashboards
├── data/           # data lifecycle (raw/processed are gitignored; see data/README.md)
├── infra/          # deployment (Fly.io) config
├── docs/           # architecture & design docs
├── Makefile        # top-level task runner — `make help`
└── docker-compose.yml   # local deps: Postgres, Ollama, Langfuse
```

## Quickstart

Everything runs through **Make**. Start here:

```bash
make help          # list all tasks
make setup         # install backend (uv) + frontend (pnpm) deps
make up            # start local deps (Postgres, Ollama, Langfuse) via Docker
make data          # download + build the M5 FOODS slice into Parquet
make dev           # run API + web together for local development
```

Core analytical pipeline (deterministic, no LLM needed):

```bash
make train         # train the LightGBM quantile forecaster
make backtest      # rolling-origin forecast backtest (WRMSSE + pinball)
make simulate      # run the inventory simulation vs baseline → headline numbers
make eval          # full eval harness (forecast + decision + agent)
```

## Stack
Python · FastAPI · LangGraph · Polars · DuckDB · LightGBM/mlforecast · MLflow ·
Next.js · Auth.js · Postgres (Neon) · Ollama / Groq · Langfuse · Logfire · Fly.io

## Status
🚧 In development.
