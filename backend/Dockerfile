# Backend image for the Inventory Copilot API.
# Build from the REPO ROOT (it needs both backend/ and data/processed/):
#   docker build -f backend/Dockerfile -t inventory-copilot-backend .
# Multi-stage: a builder resolves the locked deps into a venv; the runtime stage carries only
# that venv, the source, and the baked processed data (raw M5 stays out via .dockerignore).

# --- builder: install locked deps + the project into /app/.venv ---
FROM python:3.12-slim-bookworm AS builder

# uv (pinned via the official image) provides fast, lockfile-faithful installs.
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0 \
    UV_PROJECT_ENVIRONMENT=/app/.venv
WORKDIR /app

# Dependencies first, so this layer caches until the lockfile changes.
COPY backend/pyproject.toml backend/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project --extra api --extra agent

# Then the source + the project install itself (hatchling reads README.md).
COPY backend/README.md ./README.md
COPY backend/src ./src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --extra api --extra agent

# --- runtime: slim image with just the venv, code, and baked data ---
FROM python:3.12-slim-bookworm AS runtime

# libgomp1 is required by lightgbm at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/app/data

COPY --from=builder /app/.venv /app/.venv
COPY backend/src ./src
# Bake the processed analytics data + trained quantile forecast the API serves from.
COPY data/processed ./data/processed

# Run as a non-root user.
RUN useradd --system --create-home appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "copilot.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
