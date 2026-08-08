"""Tests for Bearer-token verification (no DB needed)."""

import time

import jwt
import pytest
from fastapi import HTTPException

from copilot.api.security import decode_token
from copilot.config import settings

_SECRET = "test-secret"


@pytest.fixture(autouse=True)
def _configure_secret(monkeypatch):
    monkeypatch.setattr(settings, "auth_jwt_secret", _SECRET)
    monkeypatch.setattr(settings, "auth_jwt_algorithm", "HS256")


def test_valid_token_decodes():
    token = jwt.encode({"sub": "google|123", "email": "a@b.com"}, _SECRET, algorithm="HS256")
    claims = decode_token(token)
    assert claims["sub"] == "google|123"
    assert claims["email"] == "a@b.com"


def test_wrong_secret_rejected():
    token = jwt.encode({"sub": "x"}, "other-secret", algorithm="HS256")
    with pytest.raises(HTTPException) as e:
        decode_token(token)
    assert e.value.status_code == 401


def test_expired_token_rejected():
    token = jwt.encode({"sub": "x", "exp": int(time.time()) - 10}, _SECRET, algorithm="HS256")
    with pytest.raises(HTTPException) as e:
        decode_token(token)
    assert e.value.status_code == 401


def test_missing_secret_is_500(monkeypatch):
    monkeypatch.setattr(settings, "auth_jwt_secret", None)
    token = jwt.encode({"sub": "x"}, _SECRET, algorithm="HS256")
    with pytest.raises(HTTPException) as e:
        decode_token(token)
    assert e.value.status_code == 500
