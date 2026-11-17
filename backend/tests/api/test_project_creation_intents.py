"""A-AC1–11: real transactions, retries, templates, ownership and ordering (R10/R11/R12/R28)."""

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from threading import Event

import pytest
from fastapi import HTTPException
from sqlalchemy import text
from sqlmodel import Session, select

from app import project_creation as creation
from app.core.config import settings
from app.core.db import engine
from app.models import Activity, Project, ProjectCreationIntent, Task, User
from app.schemas import CreationOrderInput, ProjectCreationInput

EXPECTED_TITLES = {
    "zh": {
        "blank": [],
        "product": [
            "定义问题陈述",
            "用户研究计划",
            "撰写 PRD",
            "设计探索",
            "搭建 MVP",
            "Beta 发布",
        ],
        "web": [
            "站点地图与信息架构",
            "线框图",
            "视觉设计",
            "开发页面模板",
            "内容迁移",
            "QA 与上线",
        ],
        "mkt": [
            "推广活动简报",
            "受众研究",
            "创意素材",
            "渠道规划",
            "活动上线",
            "效果报告",
        ],
        "design": ["探索工作坊", "情绪板", "概念方向", "细节打磨", "开发交接"],
        "software": [
            "技术方案",
            "搭建仓库与 CI",
            "实现核心 API",
            "编写测试",
            "代码评审",
            "部署到预发环境",
        ],
        "personal": [
            "头脑风暴，记下所有想法",
            "挑出 3 件最重要的事",
            "安排专注时段",
            "每周回顾",
        ],
    },
    "en": {
        "blank": [],
        "product": [
            "Define problem statement",
            "User research plan",
            "Write PRD",
            "Design exploration",
            "Build MVP",
            "Beta launch",
        ],
        "web": [
            "Sitemap & IA",
            "Wireframes",
            "Visual design",
            "Build page templates",
            "Content migration",
            "QA & launch",
        ],
        "mkt": [
            "Campaign brief",
            "Audience research",
            "Creative assets",
            "Channel plan",
            "Campaign launch",
            "Performance report",
        ],
        "design": [
            "Discovery workshop",
            "Mood board",
            "Concept directions",
            "Detail polish",
            "Dev handoff",
        ],
        "software": [
            "Tech design",
            "Set up repo & CI",
            "Implement core API",
            "Write tests",
            "Code review",
            "Deploy to staging",
        ],
        "personal": [
            "Brainstorm all ideas",
            "Pick the 3 most important things",
            "Schedule focus time",
            "Weekly review",
        ],
    },
}


@pytest.fixture
def owner() -> User:
    with Session(engine) as session:
        user = session.exec(
            select(User).where(User.username == settings.FIRST_SUPERUSER)
        ).one()
        session.expunge(user)
        return user


def request_for(
    template: str = "product", language: str = "zh"
) -> ProjectCreationInput:
    return ProjectCreationInput.model_validate(
        {
            "project": {"key": uuid.uuid4().hex[:16], "name": "  同名项目  "},
            "template_id": template,
            "content_language": language,
            "calendar_base_date": "2026-11-17",
        }
    )


def intent(user: User) -> str:
    return f"{user.id}.{uuid.uuid4()}"


def rows(project_id: uuid.UUID) -> tuple[list[Task], list[Activity]]:
    with Session(engine) as session:
        return (
            list(
                session.exec(
                    select(Task)
                    .where(Task.project_id == project_id)
                    .order_by(Task.order)
                ).all()
            ),
            list(
                session.exec(
                    select(Activity).where(Activity.project_id == project_id)
                ).all()
            ),
        )


@pytest.mark.parametrize("template", list(EXPECTED_TITLES["zh"]))
@pytest.mark.parametrize("language", ["zh", "en"])
def test_all_templates_atomic_and_replay(
    owner: User, template: str, language: str
) -> None:
    payload = request_for(template, language)
    key = intent(owner)
    result = creation.create_or_retry(engine, owner, key, payload)
    assert result.state == "succeeded"  # R11 A-AC1
    assert result.project is not None and result.project.name == "同名项目"
    tasks, activity = rows(result.project_id)
    assert [t.title for t in tasks] == EXPECTED_TITLES[language][template]
    assert len(activity) == len(tasks) + 1
    assert result.may_auto_order
    replay = creation.create_or_retry(engine, owner, key, payload)
    assert replay.state == "succeeded" and replay.project_id == result.project_id
    assert not replay.may_auto_order
    assert len(rows(result.project_id)[1]) == len(activity)
    with Session(engine) as session:
        found = creation.read_creation(session, owner, key)
        assert found.state == "succeeded" and not found.may_auto_order


def test_midway_failure_rolls_back_and_same_id_retry_freezes(
    owner: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    payload = request_for()
    key = intent(owner)
    original = creation.services.log_activity
    count = 0

    def fail_midway(*args, **kwargs):
        nonlocal count
        count += 1
        original(*args, **kwargs)
        if count == 4:
            raise RuntimeError("test failure after partial task staging")

    with monkeypatch.context() as patch:
        patch.setattr(creation.services, "log_activity", fail_midway)
        failed = creation.create_or_retry(engine, owner, key, payload)
    assert failed.state == "failed"  # R10 A-AC1/5/6
    with Session(engine) as session:
        assert (
            session.exec(
                select(Project).where(Project.key == payload.project.key)
            ).first()
            is None
        )
        stored = session.get(
            ProjectCreationIntent, (owner.id, uuid.UUID(key.split(".")[1]))
        )
        assert stored is not None and stored.state == "failed"
        frozen = stored.resolved
    unchanged = creation.create_or_retry(engine, owner, key, payload)
    assert unchanged.state == "failed"  # late initial cannot silently restart
    retry = payload.model_copy(
        update={"mode": "retry", "calendar_base_date": date(2027, 1, 1)}
    )
    with monkeypatch.context() as patch:
        patch.setattr(creation, "TEMPLATE_VERSION", "new-version")
        patch.setattr(
            creation, "TITLES", {"zh": {"product": ["must not replace frozen tasks"]}}
        )
        result = creation.create_or_retry(engine, owner, key, retry)
    assert result.state == "succeeded"
    tasks, activity = rows(result.project_id)
    assert len(tasks) == 6 and len(activity) == 7
    assert tasks[0].start == date(2026, 11, 17)
    assert [str(task.id) for task in tasks] == [item["id"] for item in frozen["tasks"]]
    assert [task.order for task in tasks] == [item["order"] for item in frozen["tasks"]]
    assert [task.created_at for task in tasks] == [
        datetime.fromisoformat(item["created_at"]) for item in frozen["tasks"]
    ]
    with Session(engine) as session:
        stored = session.get(
            ProjectCreationIntent, (owner.id, uuid.UUID(key.split(".")[1]))
        )
        assert stored is not None and stored.resolved == frozen


def test_concurrent_request_never_queues_to_restage(
    owner: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    entered, release = Event(), Event()
    original = creation.stage_complete_creation

    def paused(*args, **kwargs):
        entered.set()
        assert release.wait(10)
        return original(*args, **kwargs)

    payload, key = request_for(), intent(owner)
    with monkeypatch.context() as patch, ThreadPoolExecutor(max_workers=2) as pool:
        patch.setattr(creation, "stage_complete_creation", paused)
        first = pool.submit(creation.create_or_retry, engine, owner, key, payload)
        try:
            assert entered.wait(10)
            second = pool.submit(
                creation.create_or_retry, engine, owner, key, payload
            ).result(3)
            assert (
                second.state == "processing"
            )  # R28 A-AC6, not a queued second creation
            with Session(engine) as session:
                assert creation.read_creation(session, owner, key).state == "processing"
        finally:
            release.set()
        result = first.result(10)
    assert result.state == "succeeded"
    replay = creation.create_or_retry(engine, owner, key, payload)
    assert replay.state == "succeeded" and replay.project_id == result.project_id
    assert tuple(map(len, rows(result.project_id))) == (6, 7)


def test_conflicts_distinct_intents_and_delete_tombstone(owner: User) -> None:
    payload, key = request_for(), intent(owner)
    first = creation.create_or_retry(engine, owner, key, payload)
    assert first.state == "succeeded"
    changed = payload.model_copy(deep=True)
    changed.project.name = "changed"
    with pytest.raises(HTTPException) as exc:
        creation.create_or_retry(engine, owner, key, changed)
    assert exc.value.status_code == 409  # R11 A-AC7
    other = creation.create_or_retry(engine, owner, intent(owner), request_for())
    assert other.state == "succeeded" and other.project_id != first.project_id
    with Session(engine) as session:
        p = session.get(Project, first.project_id)
        assert p is not None
        session.delete(p)
        session.commit()
    result = creation.create_or_retry(
        engine, owner, key, payload.model_copy(update={"mode": "retry"})
    )
    assert result.state == "succeeded_deleted" and result.project_id == first.project_id
    with Session(engine) as session:
        assert session.get(Project, first.project_id) is None
        assert creation.read_creation(session, owner, key).state == "succeeded_deleted"


def test_owner_isolation_and_unknown(owner: User, authed_client) -> None:
    stranger = User(
        id=uuid.uuid4(), username="detached-test-account", hashed_password="unused"
    )
    payload, key = request_for(), intent(owner)
    creation.create_or_retry(engine, owner, key, payload)
    with Session(engine) as session:
        assert creation.read_creation(session, stranger, key).model_dump() == {
            "state": "unknown"
        }
        assert creation.read_creation(
            session, stranger, intent(owner)
        ).model_dump() == {"state": "unknown"}
        assert creation.read_creation(session, owner, intent(owner)).state == "unknown"
    for foreign in (key, intent(owner)):
        with pytest.raises(HTTPException) as exc:
            creation.create_or_retry(engine, stranger, foreign, payload)
        assert (exc.value.status_code, exc.value.detail) == (
            404,
            "创建意图不可用",
        )  # R12
    for extra in ({"tasks": []}, {"template_id": "unknown"}):
        body = {**payload.model_dump(mode="json"), **extra}
        assert (
            authed_client.post(
                f"/api/project-creations/{intent(owner)}", json=body
            ).status_code
            == 422
        )
    nested = payload.model_dump(mode="json")
    nested["project"]["tasks"] = []
    assert (
        authed_client.post(
            f"/api/project-creations/{intent(owner)}", json=nested
        ).status_code
        == 422
    )


def test_commit_response_loss_reads_success_without_second_effects(
    owner: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = Session.commit
    calls = 0

    def lose_reply(session):
        nonlocal calls
        original(session)
        calls += 1
        if calls == 2:
            raise ConnectionError("test: success committed but response lost")

    payload, key = request_for(), intent(owner)
    with monkeypatch.context() as patch:
        patch.setattr(Session, "commit", lose_reply)
        with pytest.raises(ConnectionError):
            creation.create_or_retry(engine, owner, key, payload)
    with Session(engine) as session:
        result = creation.read_creation(session, owner, key)
    assert result.state == "succeeded"  # R10 A-AC4/5
    replay = creation.create_or_retry(
        engine, owner, key, payload.model_copy(update={"mode": "retry"})
    )
    assert replay.state == "succeeded" and replay.project_id == result.project_id
    assert tuple(map(len, rows(result.project_id))) == (6, 7)


def test_session_lock_crosses_commits_and_invalidated_writer_cannot_reconnect(
    owner: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    nonce = uuid.uuid4()
    with creation.intent_session(engine, owner.id, nonce) as (session, held):
        assert held
        for _ in range(2):
            session.execute(text("SELECT 1"))
            session.commit()
            with engine.connect() as other:
                assert not other.scalar(
                    text("SELECT pg_try_advisory_lock(:key)"),
                    {"key": creation.lock_key(owner.id, nonce)},
                )
    original = Session.commit

    def disconnect(session):
        original(session)
        session.get_bind().invalidate()

    payload, key = request_for(), intent(owner)
    with monkeypatch.context() as patch:
        patch.setattr(Session, "commit", disconnect)
        with pytest.raises(RuntimeError, match="禁止重新连接"):
            creation.create_or_retry(engine, owner, key, payload)
    with Session(engine) as session:
        assert creation.read_creation(session, owner, key).state == "processing"
        assert (
            session.exec(
                select(Project).where(Project.key == payload.project.key)
            ).first()
            is None
        )
    result = creation.create_or_retry(
        engine, owner, key, payload.model_copy(update={"mode": "retry"})
    )
    assert result.state == "succeeded"  # R28 A-AC5/6: orphan recovered only explicitly


def test_automatic_sort_claim_survives_failure_explicit_sort_only(owner: User) -> None:
    payload, key = request_for(), intent(owner)
    result = creation.create_or_retry(engine, owner, key, payload)
    assert result.state == "succeeded"
    with Session(engine) as session:
        p = session.get(Project, result.project_id)
        assert p is not None
        p.archived = True
        old_order = p.order
        session.add(p)
        session.commit()
    with pytest.raises(HTTPException):
        creation.order_creation(
            engine, owner, key, CreationOrderInput(order=-100, mode="automatic")
        )
    with Session(engine) as session:
        p = session.get(Project, result.project_id)
        assert p is not None
        p.archived = False
        session.add(p)
        session.commit()
    creation.order_creation(
        engine, owner, key, CreationOrderInput(order=-200, mode="automatic")
    )
    with Session(engine) as session:
        p = session.get(Project, result.project_id)
        assert p is not None and p.order == old_order
    creation.order_creation(
        engine, owner, key, CreationOrderInput(order=-300, mode="explicit")
    )
    with Session(engine) as session:
        p = session.get(Project, result.project_id)
        assert p is not None and p.order == -300
    assert tuple(map(len, rows(result.project_id))) == (6, 7)  # R11 A-AC2


def test_http_contract_and_unauthenticated_no_writes(owner: User, authed_client):
    """R11/R12: exercise actual routing/serialization and auth before a write."""
    from fastapi.testclient import TestClient
    from sqlalchemy import func

    from app.main import app

    payload, key = request_for(), intent(owner)
    response = authed_client.post(
        f"/api/project-creations/{key}", json=payload.model_dump(mode="json")
    )
    assert response.status_code == 200
    result = response.json()
    assert result["state"] == "succeeded" and result["task_count"] == 6
    assert (
        authed_client.get(f"/api/project-creations/{key}").json()["may_auto_order"]
        is False
    )
    assert (
        authed_client.patch(
            f"/api/project-creations/{key}/order",
            json={"order": -50, "mode": "explicit"},
        ).status_code
        == 204
    )
    with Session(engine) as session:
        before = session.exec(
            select(func.count()).select_from(ProjectCreationIntent)
        ).one()
    with TestClient(app) as guest:
        assert (
            guest.post(
                f"/api/project-creations/{intent(owner)}",
                json=payload.model_dump(mode="json"),
            ).status_code
            == 401
        )
        assert guest.get(f"/api/project-creations/{key}").status_code == 401
        assert (
            guest.patch(
                f"/api/project-creations/{key}/order",
                json={"order": -99, "mode": "automatic"},
            ).status_code
            == 401
        )
    with Session(engine) as session:
        assert (
            session.exec(select(func.count()).select_from(ProjectCreationIntent)).one()
            == before
        )


@pytest.fixture
def other_account():
    from app import crud

    username = f"batch-a-{uuid.uuid4().hex}@example.com"
    with Session(engine) as session:
        user = crud.create_user(session, username, "isolated-test-account-1")
        user_id = user.id
    try:
        yield username
    finally:
        with Session(engine) as session:
            user = session.get(User, user_id)
            if user is not None:
                session.delete(user)
                session.commit()


def test_http_other_account_cannot_distinguish_foreign_identifiers(
    owner: User, authed_client, other_account
):
    """R12 A-AC8: authenticated account B sees identical results for known/unknown A ids."""
    from fastapi.testclient import TestClient

    from app.main import app

    payload, key = request_for(), intent(owner)
    assert (
        authed_client.post(
            f"/api/project-creations/{key}", json=payload.model_dump(mode="json")
        ).status_code
        == 200
    )
    username = other_account
    with TestClient(app) as other:
        assert (
            other.post(
                "/api/auth/login",
                json={"username": username, "password": "isolated-test-account-1"},
            ).status_code
            == 200
        )
        assert (
            other.get(f"/api/project-creations/{key}").json()
            == other.get(f"/api/project-creations/{intent(owner)}").json()
            == {"state": "unknown"}
        )
        responses = [
            other.post(
                f"/api/project-creations/{foreign}",
                json=payload.model_dump(mode="json"),
            )
            for foreign in (key, intent(owner))
        ]
        assert [r.status_code for r in responses] == [404, 404]
        assert (
            responses[0].json() == responses[1].json() == {"detail": "创建意图不可用"}
        )
