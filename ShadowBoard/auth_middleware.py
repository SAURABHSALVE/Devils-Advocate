import os
from typing import Optional
import httpx
from jose import jwt, JWTError
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

_jwks_cache: list[dict] | None = None


def _get_jwks() -> list[dict]:
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    url = os.getenv("SUPABASE_URL", "")
    if not url:
        raise RuntimeError("SUPABASE_URL env var not set")
    resp = httpx.get(f"{url}/auth/v1/.well-known/jwks.json", timeout=10)
    resp.raise_for_status()
    _jwks_cache = resp.json()["keys"]
    return _jwks_cache


def _decode(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "ES256")
        kid = header.get("kid")

        if alg == "HS256":
            # Legacy token — fall back to shared secret
            secret = os.getenv("SUPABASE_JWT_SECRET", "")
            if not secret:
                raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET not set (needed for legacy tokens)")
            return jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")

        # Modern EC/RS key — resolve via JWKS
        keys = _get_jwks()
        key = next((k for k in keys if k.get("kid") == kid), None)
        if key is None:
            key = keys[0] if keys else None
        if key is None:
            raise HTTPException(status_code=401, detail="No signing key available")

        return jwt.decode(token, key, algorithms=[alg], audience="authenticated")

    except HTTPException:
        raise
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")


def _extract_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials],
) -> Optional[str]:
    """Extract token from Authorization header OR ?token= query param (for SSE EventSource)."""
    if credentials:
        return credentials.credentials
    return request.query_params.get("token")


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Dependency — raises 401 if token is missing or invalid."""
    token = _extract_token(request, credentials)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = _decode(token)
    return {
        "user_id": payload["sub"],
        "email": payload.get("email", ""),
    }


def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict | None:
    """Dependency — returns None for unauthenticated requests instead of raising."""
    token = _extract_token(request, credentials)
    if not token:
        return None
    try:
        payload = _decode(token)
        return {
            "user_id": payload["sub"],
            "email": payload.get("email", ""),
        }
    except HTTPException:
        return None
