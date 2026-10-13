"""initial_data 幂等与 Owner 关联验收（R13、R5、R12）。

连跑两次 ``init()`` 断言：

- 管理员账号不重复创建（用户名唯一，第二次为无操作）；
- ``owner_member_id`` 关联成立：用户指向一条 role=Owner 的 member 记录；
- 第二次运行不重复建 Owner 成员（Owner 计数不增）。
"""

from sqlmodel import Session, func, select

from app.core.db import engine
from app.initial_data import init
from app.models import Member, User


def _counts(session: Session) -> tuple[int, int]:
    users = session.exec(select(func.count()).select_from(User)).one()
    owners = session.exec(
        select(func.count()).select_from(Member).where(Member.role == "Owner")
    ).one()
    return users, owners


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

        users_count, owners_count = _counts(session)
        assert users_count == 1  # 单管理员（R12）
        assert owners_count >= 1  # 至少一条 Owner 记录；连跑不新增
