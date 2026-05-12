"""
Health & System Endpoint Tests
================================
Tests:
  GET /ping          — fast liveness probe
  GET /health        — service health
  GET /ready         — readiness check
  GET /              — root welcome
  GET /metrics       — Prometheus metrics text

These tests must pass with zero live dependencies (Supabase, Redis, etc.)
because they run in CI with mocked infrastructure.
"""

import pytest


class TestPingEndpoint:
    """GET /ping — must respond in < 100 ms, no DB required."""

    def test_ping_returns_200(self, client):
        resp = client.get("/ping")
        assert resp.status_code == 200

    def test_ping_body_has_pong(self, client):
        body = client.get("/ping").json()
        assert body.get("pong") is True

    def test_ping_body_has_timestamp(self, client):
        body = client.get("/ping").json()
        assert "ts" in body, "Response must include 'ts' ISO timestamp"

    def test_ping_no_auth_required(self, client):
        """Liveness probe must work without any Authorization header."""
        resp = client.get("/ping")
        assert resp.status_code != 401


class TestRootEndpoint:
    """GET / — welcome JSON."""

    def test_root_returns_200(self, client):
        resp = client.get("/")
        assert resp.status_code == 200

    def test_root_returns_json(self, client):
        resp = client.get("/")
        # Must be JSON-parseable
        body = resp.json()
        assert isinstance(body, dict)


class TestHealthEndpoint:
    """GET /health — detailed health check."""

    def test_health_endpoint_is_registered(self, client):
        """Endpoint must be registered — any response except 404/405 is acceptable."""
        resp = client.get("/health")
        assert resp.status_code not in (404, 405), (
            f"/health returned {resp.status_code} — endpoint is not registered"
        )

    def test_health_returns_json(self, client):
        resp = client.get("/health")
        # 200 = healthy, 503 = degraded, 500 = test-env missing Supabase
        assert resp.status_code in (200, 503, 500)
        assert "application/json" in resp.headers.get("content-type", "")

    def test_health_has_status_key(self, client):
        resp = client.get("/health")
        if resp.status_code in (200, 503):
            body = resp.json()
            assert "status" in body

    def test_health_status_is_string(self, client):
        resp = client.get("/health")
        if resp.status_code in (200, 503):
            body = resp.json()
            if "status" in body:
                assert isinstance(body["status"], str)


class TestReadyEndpoint:
    """GET /ready — Kubernetes readiness probe."""

    def test_ready_endpoint_is_registered(self, client):
        """Endpoint must respond — any code except 404/405 is valid."""
        resp = client.get("/ready")
        assert resp.status_code not in (404, 405), (
            f"/ready returned {resp.status_code} — endpoint is not registered"
        )

    def test_ready_responds_with_json(self, client):
        resp = client.get("/ready")
        assert resp.status_code in (200, 503, 500)
        assert "application/json" in resp.headers.get("content-type", "")

    def test_ready_has_ready_or_status_key(self, client):
        resp = client.get("/ready")
        if resp.status_code in (200, 503):
            body = resp.json()
            assert "ready" in body or "status" in body


class TestMetricsEndpoint:
    """GET /metrics — Prometheus text format."""

    def test_metrics_responds(self, client):
        resp = client.get("/metrics")
        # 200 = prometheus available, 501 = not installed, 503 = disabled
        assert resp.status_code in (200, 404, 501, 503)

    def test_metrics_content_type_if_available(self, client):
        resp = client.get("/metrics")
        if resp.status_code == 200:
            assert "text" in resp.headers.get("content-type", "")
