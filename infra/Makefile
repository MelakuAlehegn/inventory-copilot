# Infra task runner (Fly.io). Invoked by the top-level Makefile.
.DEFAULT_GOAL := help
.PHONY: help deploy deploy-api deploy-web

help: ## Show this help
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

deploy: deploy-api deploy-web ## Deploy API + web to Fly.io

deploy-api: ## Deploy the FastAPI backend
	fly deploy --config fly/api.fly.toml

deploy-web: ## Deploy the Next.js frontend
	fly deploy --config fly/web.fly.toml
