"""initial_data 幂等与 Owner 关联验收（R13、R5、R12、R7）。

连跑两次 ``init()`` 断言：

- 管理员账号不重复创建（用户名唯一，第二次为无操作）；
- ``owner_member_id`` 关联成立：用户指向一条 role=Owner 的 member 记录；
- 第二次运行不重复建 Owner 成员（Owner 计数不增）；
- PR-4 全量种子幂等：连跑两次后各实体计数不变（自然键判重，零重复零报错）；
- Owner 衔接（调度方核定）：既有 Owner（email=FIRST_SUPERUSER）就地更新展示字段
  （name=林一舟、title=产品负责人），保留其 id 与 email 不变；
- 偏好（R7）：管理员 preference 行存在且 data 含 workspace 键。
"""

from sqlmodel import Session, func, select

from app import seed_data
from app.core.config import settings
from app.core.db import engine
from app.initial_data import init
from app.models import (
    Activity,
    Comment,
    Event,
    File,
    Member,
    Notif,
    Preference,
    Project,
    SavedView,
    Subtask,
    Task,
    Team,
    User,
)


def _counts(session: Session) -> dict[str, int]:
    def n(model: type) -> int:
        return session.exec(select(func.count()).select_from(model)).one()

    return {
        "users": n(User),
        "owners": session.exec(
            select(func.count()).select_from(Member).where(Member.role == "Owner")
        ).one(),
        "members": n(Member),
        "teams": n(Team),
        "projects": n(Project),
        "tasks": n(Task),
        "subtasks": n(Subtask),
        "comments": n(Comment),
        "activity": n(Activity),
        "notifs": n(Notif),
        "files": n(File),
        "events": n(Event),
        "saved_views": n(SavedView),
    }


def test_initial_data_idempotent_and_owner_linked() -> None:  # R13, R5
    init()  # 第一次：创建（或确认）管理员并关联 Owner
    init()  # 第二次：无操作（幂等）

    with Session(engine) as session:
        user = session.exec(select(User)).first()
        assert user is not None
        assert user.owner_member_id is not None

        owner = session.get(Member, user.owner_member_id)
        assert owner is not None
        assert owner.role == "Owner"

        counts = _counts(session)
        assert counts["users"] == 1  # 单管理员（R12）
        assert counts["owners"] >= 1  # 至少一条 Owner 记录；连跑不新增


def test_seed_idempotent_second_run_zero_growth() -> None:  # R13
    """连跑两次 init()：各实体计数不变（自然键判重，零重复零报错）。"""
    init()
    with Session(engine) as session:
        before = _counts(session)
    init()
    with Session(engine) as session:
        after = _counts(session)
    assert before == after


def test_seed_covers_all_entities_with_counts() -> None:  # R13, R11
    """种子覆盖全实体（含 notifs / activity / files / events / saved_view）。"""
    with Session(engine) as session:
        counts = _counts(session)
    assert counts["members"] >= len(seed_data.MEMBERS)
    assert counts["teams"] >= len(seed_data.TEAMS)
    assert counts["projects"] >= len(seed_data.PROJECTS)
    assert counts["tasks"] >= len(seed_data.TASKS)
    assert counts["comments"] >= len(seed_data.COMMENTS)
    assert counts["activity"] >= len(seed_data.ACTIVITIES)
    assert counts["notifs"] >= len(seed_data.NOTIFS)
    assert counts["files"] >= len(seed_data.FILES)
    assert counts["events"] >= len(seed_data.EVENTS)
    assert counts["saved_views"] >= len(seed_data.SAVED_VIEWS)
    assert counts["subtasks"] >= sum(len(t.subtasks) for t in seed_data.TASKS)
    # R11 规模口径上界（含其他用例新建的少量行）
    assert counts["members"] <= 100
    assert counts["tasks"] <= 2000


def test_owner_member_updated_in_place() -> None:  # R13, R5
    """既有 Owner（PR-3 最小记录）就地更新展示字段，id 与 email 不变。"""
    with Session(engine) as session:
        user = session.exec(select(User)).first()
        assert user is not None and user.owner_member_id is not None
        owner = session.get(Member, user.owner_member_id)
        assert owner is not None
        assert owner.email == settings.FIRST_SUPERUSER  # email 保留
        assert owner.name == "林一舟"  # 展示字段就地更新
        assert owner.title == "产品负责人"
        assert owner.avatar_color == "#5A67D8"
        assert owner.team_id is not None
        assert owner.status == "active"
        assert owner.timezone == "杭州"


def test_admin_preference_has_workspace_key() -> None:  # R7, R13
    with Session(engine) as session:
        user = session.exec(select(User)).first()
        assert user is not None
        pref = session.exec(
            select(Preference).where(Preference.user_id == user.id)
        ).first()
        assert pref is not None
        assert pref.data["workspace"]["name"] == "Memo"
