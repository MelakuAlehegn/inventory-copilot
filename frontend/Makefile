# Frontend task runner (Next.js, pnpm). Invoked by the top-level Makefile.
.DEFAULT_GOAL := help
.PHONY: help install dev build lint fmt typecheck test

help: ## Show this help
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install deps (pnpm)
	pnpm install

dev: ## Run Next.js dev server
	pnpm dev

build: ## Production build
	pnpm build

lint: ## Lint
	pnpm lint

fmt: ## Format (prettier via pnpm)
	pnpm exec prettier --write .

typecheck: ## Type-check
	pnpm typecheck

test: ## Run tests
	pnpm test
