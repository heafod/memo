"""评论表情回应写端点契约测试（PR-17 AC8 / AC9，R26 / R29）。

- 切换只增删当前成员的 id，别人的回应不动；空列表的表情键删除；
- 表情限原型 6 个或这条评论上已有的键，否则 422；缺字段 / 多余字段 422；
- 评论不存在或所属项目不可见 404（与随机 id 逐字节一致），所属项目已归档 409；
- 对不可见项目的评论，不论请求体对错，响应都与不存在的评论逐字节一致；
- 连续切换 5 次，最终状态与奇偶一致，库里没有重复 id；
- 当前用户没有关联成员的 422 排在 404 / 409 之后（FRIDAY 1815 Q6，不泄露存在性）；
- ``/snapshot`` 与 ``/api/comments`` 返回的 reactions 和库里一致。
"""

import uuid
from collections.abc import Generator, Iterator
from contextlib import contextmanager
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.core.db import engine
from app.models import Comment, User
from tests.api.test_api_visibility import ARCHIVED, _rand, _same, _set_archived
from tests.api.test_snapshot_visibility import (
    _cleanup,
    _inject_children,
    _owner_member_id,
    _project_id,
    _snap,
)

SIX = ["👍", "🎉", "❤️", "👀", "🚀", "✅"]


def _url(comment_id: str) -> str:
    return f"/api/comments/{comment_id}/reactions"


def _db_reactions(comment_id: str) -> dict[str, list[str]]:
    with Session(engine) as session:
        comment = session.get(Comment, uuid.UUID(comment_id))
        assert comment is not None
        return dict(comment.reactions)


def _other_member(snap: dict[str, Any], me: uuid.UUID) -> str:
    return next(m["id"] for m in snap["members"] if m["id"] != str(me))


@pytest.fixture
def web(authed_client: TestClient) -> Generator[dict[str, str]]:
    """WEB（可见、未归档）里的一条评论，预置别人的 👍 与一个非白名单的已有键。"""
    snap = _snap(authed_client)
    me = _owner_member_id(snap)
    other = _other_member(snap, me)
    ids = _inject_children(_project_id("WEB"), me)
    with Session(engine) as session:
        comment = session.get(Comment, uuid.UUID(ids["comments"]))
        assert comment is not None
        comment.reactions = {"👍": [other], "🙏": [other]}
        session.add(comment)
        session.commit()
    yield {**ids, "me": str(me), "other": other}
    _cleanup(ids)


@pytest.fixture
def cp(authed_client: TestClient) -> Generator[dict[str, str]]:
    ids = _inject_children(_project_id("CP"), _owner_member_id(_snap(authed_client)))
    yield ids
    _cleanup(ids)


def test_toggle_adds_and_removes_only_mine(
    authed_client: TestClient, web: dict[str, str]
) -> None:  # R26
    cid, me, other = web["comments"], web["me"], web["other"]
    r = authed_client.post(_url(cid), json={"emoji": "👍"})
    assert r.status_code == 200, r.text
    assert r.json()["reactions"] == {"👍": [other, me], "🙏": [other]}
    r = authed_client.post(_url(cid), json={"emoji": "🎉"})
    assert r.status_code == 200, r.text
    assert r.json()["reactions"]["🎉"] == [me]
    # 移除：自己的 id 去掉，别人的保留；人数为 0 的键删除
    r = authed_client.post(_url(cid), json={"emoji": "👍"})
    assert r.json()["reactions"]["👍"] == [other]
    r = authed_client.post(_url(cid), json={"emoji": "🎉"})
    assert "🎉" not in r.json()["reactions"]
    assert _db_reactions(cid) == {"👍": [other], "🙏": [other]}


def test_existing_key_allowed_other_rejected(
    authed_client: TestClient, web: dict[str, str]
) -> None:  # R26
    cid, me, other = web["comments"], web["me"], web["other"]
    # 评论上已有的非白名单键可以点
    r = authed_client.post(_url(cid), json={"emoji": "🙏"})
    assert r.status_code == 200, r.text
    assert r.json()["reactions"]["🙏"] == [other, me]
    before = _db_reactions(cid)
    for bad in ("😀", "x", "👍👍"):
        r = authed_client.post(_url(cid), json={"emoji": bad})
        assert r.status_code == 422, (bad, r.text)
    for body in ({}, {"emoji": "👍", "extra": 1}, {"emoji": 1}, {"emoji": ""}):
        r = authed_client.post(_url(cid), json=body)
        assert r.status_code == 422, (body, r.text)
    assert _db_reactions(cid) == before


def test_all_six_allowed(authed_client: TestClient, web: dict[str, str]) -> None:
    cid, me = web["comments"], web["me"]
    for e in SIX:
        r = authed_client.post(_url(cid), json={"emoji": e})
        assert r.status_code == 200, (e, r.text)
        assert me in r.json()["reactions"][e]


def test_rapid_toggle_parity_no_duplicates(
    authed_client: TestClient, web: dict[str, str]
) -> None:  # R26 AC8
    cid, me = web["comments"], web["me"]
    for _ in range(5):
        assert authed_client.post(_url(cid), json={"emoji": "🚀"}).status_code == 200
    db = _db_reactions(cid)
    assert db["🚀"] == [me]
    for ids in db.values():
        assert len(ids) == len(set(ids))


def test_reads_match_db(authed_client: TestClient, web: dict[str, str]) -> None:
    cid = web["comments"]
    authed_client.post(_url(cid), json={"emoji": "👀"})
    db = _db_reactions(cid)
    snap = next(c for c in _snap(authed_client)["comments"] if c["id"] == cid)
    assert snap["reactions"] == db
    listed = authed_client.get("/api/comments", params={"task_id": web["tasks"]})
    row = next(c for c in listed.json() if c["id"] == cid)
    assert row["reactions"] == db


def test_hidden_or_missing_404_identical(
    authed_client: TestClient, cp: dict[str, str]
) -> None:  # R26 / R29
    for body in ({"emoji": "👍"}, {"emoji": "😀"}):
        real = authed_client.post(_url(cp["comments"]), json=body)
        missing = authed_client.post(_url(_rand()), json=body)
        assert real.status_code == 404, real.text
        assert real.json() == {"detail": "评论不存在"}
        _same(real, missing)
    # 请求体不合法时，不可见与不存在的响应同样逐字节一致（不泄露存在性）
    for body in ({}, {"emoji": "👍", "extra": 1}):
        _same(
            authed_client.post(_url(cp["comments"]), json=body),
            authed_client.post(_url(_rand()), json=body),
        )


def test_hidden_and_archived_like_missing(
    authed_client: TestClient, cp: dict[str, str]
) -> None:  # R29
    cp_id = _project_id("CP")
    _set_archived(cp_id, True)
    try:
        real = authed_client.post(_url(cp["comments"]), json={"emoji": "👍"})
        assert real.status_code == 404, real.text
        _same(real, authed_client.post(_url(_rand()), json={"emoji": "👍"}))
    finally:
        _set_archived(cp_id, False)


def test_archived_409_before_422(
    authed_client: TestClient, web: dict[str, str]
) -> None:  # R26 / R29
    cid = web["comments"]
    before = _db_reactions(cid)
    web_id = _project_id("WEB")
    _set_archived(web_id, True)
    try:
        for emoji in ("👍", "😀", ""):  # 合法表情 / 不在白名单：都先 409
            r = authed_client.post(_url(cid), json={"emoji": emoji})
            assert (r.status_code, r.json()) == (409, ARCHIVED), r.text
        # 请求体格式错仍先 422（FRIDAY 1745 Q1）
        r = authed_client.post(_url(cid), json={"emoji": 1})
        assert r.status_code == 422, r.text
    finally:
        _set_archived(web_id, False)
    assert _db_reactions(cid) == before


@contextmanager
def _without_owner_member() -> Iterator[None]:
    """临时断开管理员与 Owner 成员的关联，结束后恢复。"""
    with Session(engine) as session:
        user = session.exec(
            select(User).where(User.username == settings.FIRST_SUPERUSER)
        ).one()
        saved = user.owner_member_id
        user.owner_member_id = None
        session.add(user)
        session.commit()
    try:
        yield
    finally:
        with Session(engine) as session:
            user = session.exec(
                select(User).where(User.username == settings.FIRST_SUPERUSER)
            ).one()
            user.owner_member_id = saved
            session.add(user)
            session.commit()


def test_no_member_422_after_404_and_409(
    authed_client: TestClient, web: dict[str, str], cp: dict[str, str]
) -> None:  # FRIDAY 1815 Q6
    cid = web["comments"]
    before = _db_reactions(cid)
    web_id = _project_id("WEB")
    with _without_owner_member():
        body = {"emoji": "👍"}
        missing = authed_client.post(_url(_rand()), json=body)
        assert missing.status_code == 404, missing.text
        _same(authed_client.post(_url(cp["comments"]), json=body), missing)
        _set_archived(web_id, True)
        try:
            r = authed_client.post(_url(cid), json=body)
            assert (r.status_code, r.json()) == (409, ARCHIVED), r.text
        finally:
            _set_archived(web_id, False)
        r = authed_client.post(_url(cid), json=body)
        assert (r.status_code, r.json()) == (
            422,
            {"detail": "当前用户没有关联成员"},
        ), r.text
    assert _db_reactions(cid) == before
