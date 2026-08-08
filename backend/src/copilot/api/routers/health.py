"""Health check — a cheap liveness probe for load balancers and uptime checks."""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version

from fastapi import APIRouter

from copilot.api.schemas.health import HealthResponse

router = APIRouter(tags=["health"])

try:
    _VERSION = version("inventory-copilot")
except PackageNotFoundError:  # running from source without an installed dist
    _VERSION = "unknown"


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="inventory-copilot", version=_VERSION)
