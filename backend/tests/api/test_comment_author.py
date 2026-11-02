"""评论作者权限（PR-18 AC25–AC27，R29）。

- 非作者改 / 删 → 403「只能修改自己的评论」/「只能删除自己的评论」，评论不变；
- 作者改 / 删照常 200 / 204；多余字段 422 先于 403（作者也 422）；
- 错误顺序：格式错 422 → 404 → 409 → 403；不可见评论与不存在逐字节一致（永远不是 403）。
"""

import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.db import engine
from app.models import Comment
from tests.api.test_api_visibility import ARCHIVED, _rand, _same, _set_archived
from tests.api.test_snapshot_visibility import (
    _owner_member_id,
    _project_id,
    _snap,
)
from tests.api.test_subtasks import _cleanup_all, _inject_children, _new_member

FORBID_EDIT = {"detail": "只能修改自己的评论"}
FORBID_DEL = {"detail": "只能删除自己的评论"}


@pytest.fixture
def web(authed_client: TestClient) -> Generator[dict[str, str]]:
    ids = _inject_children(_project_id("WEB"), _owner_member_id(_snap(authed_client)))
    yield ids
    _cleanup_all(ids)


@pytest.fixture
def other(authed_client: TestClient, web: dict[str, str]) -> Generator[str]:
    """同一任务上另一位成员写的评论。"""
    mid = _new_member(authed_client, "别人")
    with Session(engine) as session:
        c = Comment(
            task_id=uuid.UUID(web["tasks"]),
            by_id=uuid.UUID(mid),
            text="别人的",
            reactions={},
        )
        session.add(c)
        session.commit()
        cid = str(c.id)
    yield cid
    with Session(engine) as session:
        row = session.get(Comment, uuid.UUID(cid))
        if row:
            session.delete(row)
            session.commit()
    authed_client.delete(f"/api/members/{mid}")


def _text(cid: str) -> str | None:
    with Session(engine) as session:
        row = session.get(Comment, uuid.UUID(cid))
        return row.text if row else None


def test_non_author_403(authed_client: TestClient, other: str) -> None:  # R29
    r = authed_client.patch(f"/api/comments/{other}", json={"text": "改"})
    assert (r.status_code, r.json()) == (403, FORBID_EDIT)
    r = authed_client.delete(f"/api/comments/{other}")
    assert (r.status_code, r.json()) == (403, FORBID_DEL)
    assert _text(other) == "别人的"


def test_author_ok_and_extra_422(
    authed_client: TestClient, web: dict[str, str], other: str
) -> None:
    cid = web["comments"]
    r = authed_client.patch(f"/api/comments/{cid}", json={"text": "新"})
    assert (r.status_code, r.json()["text"]) == (200, "新")
    for c in (cid, other):
        r = authed_client.patch(
            f"/api/comments/{c}", json={"text": "x", "by_id": _rand()}
        )
        assert r.status_code == 422, r.text
        r = authed_client.patch(f"/api/comments/{c}", json={"text": ""})
        assert r.status_code == 422, r.text
    assert authed_client.delete(f"/api/comments/{cid}").status_code == 204
    assert _text(cid) is None


def test_order_404_409_403(authed_client: TestClient, other: str) -> None:
    web_id = _project_id("WEB")
    hidden = _inject_children(_project_id("CP"), _owner_member_id(_snap(authed_client)))
    try:
        for method, body in (("patch", {"text": "x"}), ("delete", None)):
            kw = {"json": body} if body else {}
            real = getattr(authed_client, method)(
                f"/api/comments/{hidden['comments']}", **kw
            )
            miss = getattr(authed_client, method)(f"/api/comments/{_rand()}", **kw)
            assert real.status_code == 404
            _same(real, miss)
        # 格式错的请求体：不可见与不存在同样逐字节一致（AC27）
        real = authed_client.patch(
            f"/api/comments/{hidden['comments']}", json={"text": ""}
        )
        miss = authed_client.patch(f"/api/comments/{_rand()}", json={"text": ""})
        assert real.status_code == 422
        _same(real, miss)
        _set_archived(web_id, True)
        try:
            r = authed_client.patch(f"/api/comments/{other}", json={"text": "x"})
            assert (r.status_code, r.json()) == (409, ARCHIVED)
            r = authed_client.delete(f"/api/comments/{other}")
            assert (r.status_code, r.json()) == (409, ARCHIVED)
            r = authed_client.patch(
                f"/api/comments/{other}", json={"text": "x", "z": 1}
            )
            assert r.status_code == 422
        finally:
            _set_archived(web_id, False)
    finally:
        _cleanup_all(hidden)
    assert _text(other) == "别人的"


def test_openapi_declares_403(authed_client: TestClient) -> None:
    spec = authed_client.get("/api/openapi.json").json()
    for m in ("patch", "delete"):
        assert "403" in spec["paths"]["/api/comments/{comment_id}"][m]["responses"]
