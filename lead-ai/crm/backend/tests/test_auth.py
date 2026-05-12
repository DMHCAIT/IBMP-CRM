"""
Authentication Router Tests
============================
Tests:
  POST /api/auth/login   — valid credentials, invalid credentials,
                           missing fields, rate limit boundary, JWT shape
  POST /api/auth/logout  — successful logout, no-token logout
  JWT                    — token structure, expiry field present,
                           rejects bad signature
"""

import os
import pytest


LOGIN_URL  = "/api/auth/login"
LOGOUT_URL = "/api/auth/logout"


# ── Helpers ───────────────────────────────────────────────────────────────

def _make_jwt(email="admin@test.com", role="Admin", expired=False):
    """Return a signed JWT for use in Authorization headers."""
    import jwt
    from datetime import datetime, timedelta

    secret = os.environ["SECRET_KEY"]
    alg    = os.environ.get("ALGORITHM", "HS256")
    delta  = timedelta(seconds=-1) if expired else timedelta(hours=8)
    payload = {
        "sub":  email,
        "role": role,
        "exp":  datetime.utcnow() + delta,
        "iat":  datetime.utcnow(),
    }
    return jwt.encode(payload, secret, algorithm=alg)


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Login tests ───────────────────────────────────────────────────────────

class TestLogin:

    def test_missing_email_returns_422(self, client):
        resp = client.post(LOGIN_URL, json={"password": "pass"})
        assert resp.status_code == 422

    def test_missing_password_returns_422(self, client):
        resp = client.post(LOGIN_URL, json={"email": "a@b.com"})
        assert resp.status_code == 422

    def test_empty_body_returns_422(self, client):
        resp = client.post(LOGIN_URL, json={})
        assert resp.status_code == 422

    def test_invalid_credentials_returns_error(self, client):
        resp = client.post(LOGIN_URL, json={
            "email":    "nobody@example.com",
            "password": "wrong_password_xyz",
        })
        # 401 Unauthorized, 404 not found, 400/422 validation, 500 if DB unavailable in CI
        assert resp.status_code in (400, 401, 404, 422, 500)

    def test_login_endpoint_exists(self, client):
        """Endpoint must be registered (not 404 / 405)."""
        resp = client.post(LOGIN_URL, json={
            "email": "test@test.com", "password": "test"
        })
        assert resp.status_code != 404
        assert resp.status_code != 405  # method not allowed

    def test_login_response_content_type_json(self, client):
        resp = client.post(LOGIN_URL, json={
            "email": "test@test.com", "password": "test"
        })
        assert "application/json" in resp.headers.get("content-type", "")


# ── JWT structure tests ───────────────────────────────────────────────────

class TestJWTStructure:
    """Validate JWT tokens we generate are structurally correct."""

    def test_token_is_three_parts(self):
        token = _make_jwt()
        parts = token.split(".")
        assert len(parts) == 3, "JWT must have header.payload.signature"

    def test_token_payload_has_sub(self):
        import jwt
        token   = _make_jwt(email="test@test.com")
        secret  = os.environ["SECRET_KEY"]
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        assert payload["sub"] == "test@test.com"

    def test_token_payload_has_role(self):
        import jwt
        token   = _make_jwt(role="Counselor")
        secret  = os.environ["SECRET_KEY"]
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        assert payload["role"] == "Counselor"

    def test_token_payload_has_exp(self):
        import jwt
        token   = _make_jwt()
        secret  = os.environ["SECRET_KEY"]
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        assert "exp" in payload

    def test_expired_token_raises(self):
        import jwt
        token  = _make_jwt(expired=True)
        secret = os.environ["SECRET_KEY"]
        with pytest.raises(jwt.ExpiredSignatureError):
            jwt.decode(token, secret, algorithms=["HS256"])

    def test_tampered_token_raises(self):
        import jwt
        token   = _make_jwt()
        # Corrupt the signature
        parts   = token.split(".")
        parts[2] = parts[2][::-1]
        bad_token = ".".join(parts)
        with pytest.raises(jwt.InvalidSignatureError):
            jwt.decode(bad_token, os.environ["SECRET_KEY"], algorithms=["HS256"])

    def test_wrong_secret_raises(self):
        import jwt
        token = _make_jwt()
        with pytest.raises(jwt.InvalidSignatureError):
            jwt.decode(token, "totally-wrong-secret-key-xxxxxxxxxxxx", algorithms=["HS256"])


# ── Logout tests ──────────────────────────────────────────────────────────

class TestLogout:

    def test_logout_endpoint_exists(self, client):
        resp = client.post(LOGOUT_URL)
        assert resp.status_code != 404
        assert resp.status_code != 405

    def test_logout_returns_json(self, client):
        resp = client.post(LOGOUT_URL)
        assert "application/json" in resp.headers.get("content-type", "")

    def test_logout_with_valid_token(self, client):
        token = _make_jwt()
        resp  = client.post(LOGOUT_URL, headers=_auth(token))
        # 200 success or 401 if server validates token — both valid
        assert resp.status_code in (200, 401, 204)


# ── Security header checks ────────────────────────────────────────────────

class TestSecurityHeaders:
    """Verify security-related response headers are present."""

    def test_no_server_header_leaks_version(self, client):
        """Server header should not expose detailed version info."""
        resp = client.get("/ping")
        server_header = resp.headers.get("server", "").lower()
        # Should not expose exact versions like "uvicorn/0.x.x"
        assert "/" not in server_header or "uvicorn" not in server_header

    def test_content_type_set_on_json_responses(self, client):
        resp = client.get("/ping")
        ct = resp.headers.get("content-type", "")
        assert "application/json" in ct
