from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Annotated

from fastapi import Depends, Header, Request

from smileos.container import Container
from smileos.core.errors import AppError, Unauthorized
from smileos.core.security import Principal
from smileos.db.models import Profile


def get_container(request: Request) -> Container:
    return request.app.state.container


ContainerDep = Annotated[Container, Depends(get_container)]


async def get_principal(c: ContainerDep, authorization: Annotated[str | None, Header()] = None) -> Principal:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise Unauthorized()
    claims = await c.verifier.verify(authorization.split(" ", 1)[1])
    sub = claims["sub"]
    meta = claims.get("app_metadata") or {}

    async with c.sessionmaker.begin() as session:
        profile = await session.get(Profile, sub)
        if profile is None:
            profile = Profile(user_id=sub, role="patient")
            session.add(profile)
        # Role and clinic come from server-controlled app_metadata, never from user-editable fields.
        if role := meta.get("smileos_role"):
            profile.role = role
            profile.clinic_slug = meta.get("smileos_clinic")
        return Principal(sub=sub, role=profile.role, clinic=profile.clinic_slug)  # type: ignore[arg-type]


PrincipalDep = Annotated[Principal, Depends(get_principal)]


class TooManyRequests(AppError):
    status_code = 429
    code = "rate_limited"
    public_message = "Too many requests. Please wait a moment and try again."


class RateLimiter:
    """Sliding-window limiter, keyed per user. In-process only: one replica, or swap in Redis."""

    def __init__(self, limit: int, window_s: float) -> None:
        self.limit, self.window = limit, window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def __call__(self, principal: PrincipalDep) -> Principal:
        now = time.monotonic()
        q = self._hits[principal.sub]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise TooManyRequests()
        q.append(now)
        return principal
