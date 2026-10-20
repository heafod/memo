import sentry_sdk
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.api.routes import auth, health
from app.core.config import settings
from app.core.validation import request_validation_exception_handler


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


if settings.SENTRY_DSN and settings.FASTAPI_ENV != "development":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    # OpenAPI 按部署开关（R12）：非 development 不暴露 openapi.json / docs
    openapi_url=(
        f"{settings.API_PREFIX}/openapi.json"
        if settings.FASTAPI_ENV == "development"
        else None
    ),
    generate_unique_id_function=custom_generate_unique_id,
)

# R8：请求校验 422 的 msg 中文化（形态与状态码沿用框架默认）
app.add_exception_handler(RequestValidationError, request_validation_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_HOST],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(api_router, prefix=settings.API_PREFIX)
