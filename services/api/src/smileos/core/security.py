"""Bearer-token verification.

* Supabase projects sign access tokens with asymmetric keys (RS256/ES256) published as a JWKS.
* HS256 covers legacy Supabase projects and the local dev-login flow (`ALLOW_DEV_LOGIN`), so
  the stack runs end-to-end without a Supabase account.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, Literal

import jwt
from pydantic import BaseModel

from smileos.core.config import Settings
from smileos.core.errors import Unauthorized

Role = Literal["patient", "dentist"]
_ASYMMETRIC = {"RS256", "ES256"}


class Principal(BaseModel):
    sub: str
    role: Role = "patient"
    clinic: str | None = None


class TokenVerifier:
    def __init__(self, settings: Settings) -> None:
        self._secret = settings.jwt_secret.get_secret_value()
        self._audience = settings.jwt_audience
        self._jwks = jwt.PyJWKClient(settings.jwks_url, cache_keys=True) if settings.jwks_url else None

    async def verify(self, token: str) -> dict[str, Any]:
        try:
            alg = jwt.get_unverified_header(token).get("alg")
            if alg == "HS256":
                key: Any = self._secret
            elif alg in _ASYMMETRIC and self._jwks is not None:
                key = (await asyncio.to_thread(self._jwks.get_signing_key_from_jwt, token)).key
            else:
                raise Unauthorized(detail=f"unsupported alg {alg}")
            return jwt.decode(
                token, key, algorithms=[alg], audience=self._audience, options={"require": ["exp", "sub"]}
            )
        except jwt.PyJWTError as exc:
            raise Unauthorized(detail=str(exc)) from exc

    def issue_dev_token(self, email: str, role: Role, clinic: str | None, ttl_s: int = 8 * 3600) -> tuple[str, str]:
        sub = str(uuid.uuid5(uuid.NAMESPACE_URL, f"smileos-dev:{email.lower()}"))
        now = int(time.time())
        claims = {
            "sub": sub,
            "aud": self._audience,
            "iat": now,
            "exp": now + ttl_s,
            "app_metadata": {"smileos_role": role, "smileos_clinic": clinic},
        }
        return jwt.encode(claims, self._secret, algorithm="HS256"), sub
