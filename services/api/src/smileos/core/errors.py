"""Domain errors and their HTTP mapping. Internal details go to logs, never to clients."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from smileos.core.logging import log


class AppError(Exception):
    status_code = 500
    code = "internal_error"
    public_message = "Something went wrong. Please try again."

    def __init__(self, public_message: str | None = None, *, detail: str | None = None) -> None:
        super().__init__(detail or public_message or self.public_message)
        if public_message:
            self.public_message = public_message


class BadRequest(AppError):
    status_code = 400
    code = "bad_request"
    public_message = "The request was invalid."


class Unauthorized(AppError):
    status_code = 401
    code = "unauthorized"
    public_message = "Authentication required."


class Forbidden(AppError):
    status_code = 403
    code = "forbidden"
    public_message = "You don't have access to this resource."


class NotFound(AppError):
    status_code = 404
    code = "not_found"
    public_message = "Not found."


class Conflict(AppError):
    status_code = 409
    code = "conflict"
    public_message = "The resource is not in a state that allows this action."


class ModelUnavailable(AppError):
    status_code = 503
    code = "model_unavailable"
    public_message = "The AI model is temporarily unavailable. Please try again shortly."


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError) -> JSONResponse:
        level = "error" if exc.status_code >= 500 else "info"
        getattr(log, level)("app_error", code=exc.code, path=request.url.path, detail=str(exc))
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.public_message}},
        )
