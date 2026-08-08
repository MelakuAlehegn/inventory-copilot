"""FastAPI application for the inventory copilot.

``create_app()`` assembles the app (CORS, error handling, routers); ``app`` is the ASGI
entry point uvicorn serves. Feature endpoints are added under ``routers/`` as the product
grows — this module stays the thin composition root.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from copilot.api.routers import chat, health, users
from copilot.config import settings

logger = logging.getLogger("copilot.api")


def create_app() -> FastAPI:
    app = FastAPI(title="Inventory Copilot API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        """Last-resort handler: log the real error, return a clean 500 to the client."""
        logger.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "internal server error"})

    app.include_router(health.router)
    app.include_router(users.router)
    app.include_router(chat.router)
    return app


app = create_app()
