"""请求校验 422 中文化验收测试（R8：服务端用户可见消息首版固定中文）。

覆盖（PR-6b）：

- 全局 ``RequestValidationError`` 处理器：状态码仍 422；``detail`` 为列表，
  ``type`` / ``loc`` 与框架默认一致，仅 ``msg`` 替换为中文；
- 端到端：multipart 缺 ``file``、路径 UUID 非法、JSON 体缺必填、枚举越界、
  字符串过短 / 过长、浮点 / 布尔解析失败、请求体非法 JSON；
- 映射表：missing、uuid_parsing、string_too_long/short、enum/literal、
  int/float/bool 解析、json_invalid 逐类（以 pydantic 真实错误驱动）；未映射回退
  「参数校验失败」；自定义校验器中文消息原样透出、英文消息回退；
- 所有断言 msg 不含 ASCII 英文单词；既有 HTTPException 中文 detail 不受影响。
"""

import re
import uuid
from enum import Enum
from typing import Any, Literal

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field, TypeAdapter, ValidationError, field_validator

from app.core.validation import FALLBACK_MSG, zh_message

ASCII_WORD = re.compile(r"[A-Za-z]{2,}")


def _errors(resp) -> list[dict[str, Any]]:
    assert resp.status_code == 422, resp.text  # R8：状态码不变
    detail = resp.json()["detail"]
    assert isinstance(detail, list) and detail  # 框架默认形态：错误列表
    for item in detail:
        assert {"type", "loc", "msg"} <= item.keys()
        assert not ASCII_WORD.search(item["msg"]), item  # R8 无英文残留
    return detail


def _find(detail: list[dict[str, Any]], loc: list[Any]) -> dict[str, Any]:
    return next(item for item in detail if item["loc"] == loc)


def _web_project_id(client: TestClient) -> str:
    snap = client.get("/api/snapshot").json()
    return next(p for p in snap["projects"] if p.get("key") == "WEB")["id"]


# ---------- 端到端（规格要求的四类 + 其余映射） ----------


def test_multipart_missing_file(authed_client: TestClient) -> None:  # R8, R4b
    resp = authed_client.post(
        "/api/files", data={"project_id": _web_project_id(authed_client)}
    )
    err = _find(_errors(resp), ["body", "file"])
    assert err["type"] == "missing"
    assert err["msg"] == "缺少必填字段"


def test_path_uuid_invalid(authed_client: TestClient) -> None:  # R8
    resp = authed_client.get("/api/files/not-a-uuid/content")
    err = _find(_errors(resp), ["path", "file_id"])
    assert err["type"] == "uuid_parsing"
    assert err["msg"] == "唯一标识格式无效"
    assert err["input"] == "not-a-uuid"  # 默认字段原样保留


def test_json_body_missing_required(authed_client: TestClient) -> None:  # R8, R17
    resp = authed_client.post("/api/events", json={"date": "2030-06-15"})
    err = _find(_errors(resp), ["body", "title"])
    assert err["type"] == "missing"
    assert err["msg"] == "缺少必填字段"


def test_enum_out_of_range(authed_client: TestClient) -> None:  # R8, R18
    resp = authed_client.post(
        "/api/saved-views",
        json={
            "project_id": _web_project_id(authed_client),
            "name": "PR-6b 越界布局",
            "layout": "grid",
            "filters": [],
        },
    )
    err = _find(_errors(resp), ["body", "layout"])
    assert err["type"] == "literal_error"
    assert err["msg"] == "取值不在允许范围内"
    assert "expected" in err["ctx"]  # ctx 原样保留


def test_string_length(authed_client: TestClient) -> None:  # R8
    resp = authed_client.post("/api/events", json={"title": "", "date": "2030-06-15"})
    err = _find(_errors(resp), ["body", "title"])
    assert err["type"] == "string_too_short"
    assert err["msg"] == "长度不能少于 1 个字符"
    resp = authed_client.post(
        "/api/events", json={"title": "长" * 256, "date": "2030-06-15"}
    )
    err = _find(_errors(resp), ["body", "title"])
    assert err["type"] == "string_too_long"
    assert err["msg"] == "长度不能超过 255 个字符"


def test_float_and_bool_parsing(authed_client: TestClient) -> None:  # R8
    resp = authed_client.patch(f"/api/tasks/{uuid.uuid4()}", json={"order": "abc"})
    err = _find(_errors(resp), ["body", "order"])
    assert err["type"] == "float_parsing"
    assert err["msg"] == "须为数字"
    resp = authed_client.patch(f"/api/notifs/{uuid.uuid4()}", json={"read": "maybe"})
    err = _find(_errors(resp), ["body", "read"])
    assert err["type"] == "bool_parsing"
    assert err["msg"] == "须为布尔值"


def test_json_invalid(authed_client: TestClient) -> None:  # R8
    resp = authed_client.post(
        "/api/events",
        content=b'{"title": ',
        headers={"content-type": "application/json"},
    )
    err = _errors(resp)[0]
    assert err["type"] == "json_invalid"
    assert err["msg"] == "请求体格式错误，无法解析"


def test_custom_validator_chinese_passthrough(authed_client: TestClient) -> None:  # R8
    """密码策略 ValueError 为中文文案，原样透出（不被映射覆盖）。"""
    resp = authed_client.post(
        "/api/auth/password",
        json={"old_password": "whatever", "new_password": "short1"},
    )
    err = _find(_errors(resp), ["body", "new_password"])
    assert err["type"] == "value_error"
    assert err["msg"] == "密码至少 10 位且须含数字或符号"


def test_http_exception_detail_unaffected(authed_client: TestClient) -> None:  # R8
    """HTTPException 的中文字符串 detail 不经本处理器，保持原样。"""
    resp = authed_client.post(
        "/api/events",
        json={"title": "PR-6b", "date": "2030-06-15", "project_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 422
    assert resp.json() == {"detail": "所属项目不存在"}
    resp = authed_client.get(f"/api/files/{uuid.uuid4()}/content")
    assert resp.json() == {"detail": "文件不存在"}


# ---------- 映射表（pydantic 真实错误驱动） ----------


class _Color(Enum):
    red = "red"


class _Model(BaseModel):
    s_min: str = Field(default="xx", min_length=2)
    s_max: str = Field(default="x", max_length=1)
    i: int = 0
    f: float = 0.0
    b: bool = False
    u: uuid.UUID | None = None
    e: _Color = _Color.red
    lit: Literal["a"] = "a"


def _first_error(**kwargs: Any) -> dict[str, Any]:
    with pytest.raises(ValidationError) as info:
        _Model(**kwargs)
    return info.value.errors()[0]


@pytest.mark.parametrize(
    ("kwargs", "etype", "msg"),
    [
        ({"s_min": "x"}, "string_too_short", "长度不能少于 2 个字符"),
        ({"s_max": "xy"}, "string_too_long", "长度不能超过 1 个字符"),
        ({"i": "x"}, "int_parsing", "须为整数"),
        ({"f": "x"}, "float_parsing", "须为数字"),
        ({"b": "x"}, "bool_parsing", "须为布尔值"),
        ({"u": "x"}, "uuid_parsing", "唯一标识格式无效"),
        ({"e": "blue"}, "enum", "取值不在允许范围内"),
        ({"lit": "b"}, "literal_error", "取值不在允许范围内"),
    ],
)
def test_mapping_by_type(kwargs: dict[str, Any], etype: str, msg: str) -> None:  # R8
    error = _first_error(**kwargs)
    assert error["type"] == etype
    assert zh_message(error) == msg
    assert not ASCII_WORD.search(zh_message(error))


def test_mapping_missing_and_json_invalid() -> None:  # R8
    class Req(BaseModel):
        x: int

    with pytest.raises(ValidationError) as info:
        Req()
    assert zh_message(info.value.errors()[0]) == "缺少必填字段"
    with pytest.raises(ValidationError) as info:
        TypeAdapter(Req).validate_json("{bad")
    error = info.value.errors()[0]
    assert error["type"] == "json_invalid"
    assert zh_message(error) == "请求体格式错误，无法解析"


def test_unmapped_type_falls_back() -> None:  # R8
    assert (
        zh_message({"type": "some_future_type", "msg": "English text"}) == FALLBACK_MSG
    )
    assert zh_message({"msg": "no type"}) == FALLBACK_MSG
    # 限值缺失的模板也回退（不输出半截消息）
    assert zh_message({"type": "string_too_long", "ctx": {}}) == FALLBACK_MSG


def test_value_error_english_falls_back() -> None:  # R8
    class Req(BaseModel):
        x: str

        @field_validator("x")
        @classmethod
        def _check(cls, v: str) -> str:
            raise ValueError("bad value")

    with pytest.raises(ValidationError) as info:
        Req(x="1")
    assert zh_message(info.value.errors()[0]) == "取值无效"
