# Backend task runner (Python, uv). Invoked by the top-level Makefile.
.DEFAULT_GOAL := help
.PHONY: help install install-all data-download data-build train backtest simulate eval \
        api mcp test lint fmt typecheck clean

UV := uv run
PKG := src/copilot

help: ## Show this help
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Create venv and install core + dev deps
	uv sync --extra dev

install-all: ## Install all extras (api, agent, mcp, dev)
	uv sync --all-extras

data-download: ## Download raw M5 dataset into ../data/raw
	$(UV) python -m copilot.pipelines.download

data-build: ## Transform raw M5 -> Parquet + features in ../data/processed
	$(UV) python -m copilot.pipelines.build_features

train: ## Train the LightGBM quantile forecaster
	$(UV) python -m copilot.pipelines.train

backtest: ## Rolling-origin forecast backtest (WRMSSE + pinball)
	$(UV) python -m copilot.eval.forecast

simulate: ## Inventory simulation vs baseline -> headline numbers
	$(UV) python -m copilot.eval.decision

eval: ## Full eval harness (forecast + decision + agent)
	$(UV) python -m copilot.eval

api: ## Run FastAPI (dev, reload)
	$(UV) uvicorn copilot.api.main:app --reload --port 8000

mcp: ## Run the optional MCP server exposing core tools
	$(UV) python -m copilot.mcp.server

test: ## Run tests
	$(UV) pytest

lint: ## Lint (ruff)
	$(UV) ruff check .

fmt: ## Format (ruff)
	$(UV) ruff format .
	$(UV) ruff check --fix .

typecheck: ## Type-check (mypy)
	$(UV) mypy src

clean: ## Remove caches and build artifacts
	rm -rf .pytest_cache .mypy_cache .ruff_cache mlruns **/__pycache__
