"""请求校验错误中文化（R8：服务端用户可见消息首版固定中文）。

全局 ``RequestValidationError`` 处理器：状态码保持 422，响应形态沿用 FastAPI 默认
（``{"detail": [{"type", "loc", "msg", "input", "ctx"?}, ...]}``，``type`` / ``loc``
等字段原样保留），**仅把 ``msg`` 替换为中文**。

映射按 pydantic-core 错误 ``type``；未映射的类型统一回退「参数校验失败」，保证
不漏英文。``value_error``（自定义校验器抛 ``ValueError``）若原消息本身为中文
（如密码策略文案）则原样透出，否则回退「取值无效」。
"""

import re
from collections.abc import Callable
from typing import Any

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

FALLBACK_MSG = "参数校验失败"

# 消息中出现 ≥2 个连续 ASCII 字母即视为英文残留
_ASCII_WORD = re.compile(r"[A-Za-z]{2,}")

_Ctx = dict[str, Any]


def _limit(template: str, key: str) -> Callable[[_Ctx], str]:
    def build(ctx: _Ctx) -> str:
        value = ctx.get(key)
        return template.format(value) if value is not None else FALLBACK_MSG

    return build


def _value_error(ctx: _Ctx) -> str:
    error = ctx.get("error")
    text = str(error) if error is not None else ""
    if text and not _ASCII_WORD.search(text):
        return text
    return "取值无效"


_MESSAGES: dict[str, str | Callable[[_Ctx], str]] = {
    # 缺失 / 多余
    "missing": "缺少必填字段",
    "extra_forbidden": "不允许的额外字段",
    # 唯一标识
    "uuid_parsing": "唯一标识格式无效",
    "uuid_type": "唯一标识格式无效",
    "uuid_version": "唯一标识版本无效",
    # 字符串
    "string_type": "须为字符串",
    "string_too_short": _limit("长度不能少于 {} 个字符", "min_length"),
    "string_too_long": _limit("长度不能超过 {} 个字符", "max_length"),
    "string_pattern_mismatch": "格式不正确",
    # 枚举
    "enum": "取值不在允许范围内",
    "literal_error": "取值不在允许范围内",
    # 数值 / 布尔
    "int_parsing": "须为整数",
    "int_type": "须为整数",
    "int_from_float": "须为整数",
    "float_parsing": "须为数字",
    "float_type": "须为数字",
    "bool_parsing": "须为布尔值",
    "bool_type": "须为布尔值",
    "greater_than": _limit("须大于 {}", "gt"),
    "greater_than_equal": _limit("须大于或等于 {}", "ge"),
    "less_than": _limit("须小于 {}", "lt"),
    "less_than_equal": _limit("须小于或等于 {}", "le"),
    # 日期时间
    "date_parsing": "日期格式无效",
    "date_type": "日期格式无效",
    "date_from_datetime_parsing": "日期格式无效",
    "datetime_parsing": "日期时间格式无效",
    "datetime_type": "日期时间格式无效",
    "datetime_from_date_parsing": "日期时间格式无效",
    "time_parsing": "时间格式无效",
    # 容器
    "list_type": "须为列表",
    "dict_type": "须为对象",
    "model_type": "须为对象",
    "model_attributes_type": "须为对象",
    "too_short": _limit("至少需要 {} 项", "min_length"),
    "too_long": _limit("最多允许 {} 项", "max_length"),
    # 请求体
    "json_invalid": "请求体格式错误，无法解析",
    "json_type": "请求体格式错误，无法解析",
    # 自定义校验器
    "value_error": _value_error,
}


def zh_message(error: dict[str, Any]) -> str:
    """按错误 ``type`` 给出中文 msg；未映射回退 ``FALLBACK_MSG``。"""
    entry = _MESSAGES.get(str(error.get("type", "")))
    if entry is None:
        return FALLBACK_MSG
    if isinstance(entry, str):
        return entry
    message = entry(error.get("ctx") or {})
    return FALLBACK_MSG if _ASCII_WORD.search(message) else message


async def request_validation_exception_handler(
    _request: Request, exc: Exception
) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    errors = [{**error, "msg": zh_message(error)} for error in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(errors)})
