# Retail Demand & Inventory Copilot — top-level task runner.
# Delegates to backend/ (Python, uv) and frontend/ (Next.js, pnpm).
# Run `make help` to see all tasks.

.DEFAULT_GOAL := help
.PHONY: help setup up down logs \
        data data-download data-build \
        train backtest simulate eval \
        api web dev mcp \
        test lint fmt typecheck check \
        deploy clean

BACKEND  := backend
FRONTEND := frontend

## ----------------------------------------------------------------------------
## Meta
## ----------------------------------------------------------------------------
help: ## Show this help
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

## ----------------------------------------------------------------------------
## Environment
## ----------------------------------------------------------------------------
setup: ## Install backend (uv) and frontend (pnpm) dependencies
	$(MAKE) -C $(BACKEND) install
	$(MAKE) -C $(FRONTEND) install

up: ## Start local deps (Postgres, Ollama, Langfuse) via Docker Compose
	docker compose up -d

down: ## Stop local deps
	docker compose down

logs: ## Tail local deps logs
	docker compose logs -f

## ----------------------------------------------------------------------------
## Data pipeline (deterministic core)
## ----------------------------------------------------------------------------
data: data-download data-build ## Download + build the M5 FOODS slice

data-download: ## Download the raw M5 dataset
	$(MAKE) -C $(BACKEND) data-download

data-build: ## Transform raw M5 -> partitioned Parquet + features
	$(MAKE) -C $(BACKEND) data-build

## ----------------------------------------------------------------------------
## Modeling & simulation (deterministic core)
## ----------------------------------------------------------------------------
train: ## Train the LightGBM quantile forecaster
	$(MAKE) -C $(BACKEND) train

backtest: ## Rolling-origin forecast backtest (WRMSSE + pinball)
	$(MAKE) -C $(BACKEND) backtest

simulate: ## Inventory simulation vs baseline -> headline numbers
	$(MAKE) -C $(BACKEND) simulate

eval: ## Eval scorecard: forecast + decision (agent opt-in: --with-agent)
	$(MAKE) -C $(BACKEND) eval

## ----------------------------------------------------------------------------
## Services
## ----------------------------------------------------------------------------
api: ## Run the FastAPI backend (dev)
	$(MAKE) -C $(BACKEND) api

web: ## Run the Next.js frontend (dev)
	$(MAKE) -C $(FRONTEND) dev

dev: ## Run API + web together (see backend/frontend Makefiles)
	$(MAKE) -j2 api web

mcp: ## Run the optional MCP server exposing core tools
	$(MAKE) -C $(BACKEND) mcp

## ----------------------------------------------------------------------------
## Quality
## ----------------------------------------------------------------------------
test: ## Run backend + frontend tests
	$(MAKE) -C $(BACKEND) test
	$(MAKE) -C $(FRONTEND) test

lint: ## Lint backend + frontend
	$(MAKE) -C $(BACKEND) lint
	$(MAKE) -C $(FRONTEND) lint

fmt: ## Format backend + frontend
	$(MAKE) -C $(BACKEND) fmt
	$(MAKE) -C $(FRONTEND) fmt

typecheck: ## Type-check backend (mypy) + frontend (tsc)
	$(MAKE) -C $(BACKEND) typecheck
	$(MAKE) -C $(FRONTEND) typecheck

check: lint typecheck test ## Run all quality gates

## ----------------------------------------------------------------------------
## Deployment
## ----------------------------------------------------------------------------
deploy: ## Deploy to Fly.io (see infra/)
	$(MAKE) -C infra deploy

clean: ## Remove build artifacts and caches
	$(MAKE) -C $(BACKEND) clean
