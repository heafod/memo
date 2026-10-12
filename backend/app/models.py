"""SQLModel 领域模型（R10：任务、项目、成员、团队、评论、动态、通知、文件、日历事件、保存视图；R12：管理员账号）。

建模约定（PR-2 落盘，PR-4 在其上做领域 API 与种子）：

- 关系字段（项目成员、任务依赖、子任务）用关联表承载：``project_member_link``、
  ``task_dep_link``、``task_subtask_link``。子任务为轻量清单实体（``subtask`` 表：无任务
  key 与 status，与任务区分），经 ``task_subtask_link`` 挂到父任务；「转为任务」= 复制
  字段新建任务行后删除关联（原型 ``promoteSub`` 语义）。ORM 层不启用 SQLModel 多对多
  自动关系（关联表带附加列，如子任务顺序），PR-4 以显式查询遍历。
- 标签等弱结构数组用 JSONB：``task.labels``、``project.milestones``、
  ``comment.reactions``、``saved_view.filters``、``preference.data``；更新时整体赋值
  （不做 JSONB 局部改写）。
- 任务排序用 ``task.order``（Float8 分数插值）：拖拽落位取相邻两卡 order 的中点，
  不整列重排；项目列表顺序同理用 ``project.order``。
- 时间戳：``*_at`` 为绝对 UTC 时间；原型种子里「最后一次活动 N 分钟前」的显示值由
  PR-4 换算为 ``last_active_at`` 落库。
- 通知以（事件类型、任务、成员）唯一约束去重：同一事件对同一成员仅 1 条（R2）。
- 工作区名称 / URL 存管理员 preferences 的 ``workspace`` 键（单例语义，不新增表）。
- ``user.owner_member_id`` 关联 Owner 成员：管理员账号 ↔ 成员数据实体的唯一连接点（R5）。

枚举取值以注释标注，落库为 varchar，取值校验在 PR-4 的 API schema 层。
"""

import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import Column, Double, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


def _jsonb_array_column() -> Column[Any]:
    """弱结构数组列（JSONB，默认空数组）。"""
    return Column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )


def _jsonb_object_column() -> Column[Any]:
    """弱结构对象列（JSONB，默认空对象）。"""
    return Column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )


class Team(SQLModel, table=True):
    """团队（R5：纯数据实体，不绑定登录账号）。"""

    __tablename__ = "team"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=120)
    icon: str | None = Field(default=None, max_length=64)
    color: str | None = Field(default=None, max_length=32)
    desc: str = Field(default="", max_length=2000)


class Member(SQLModel, table=True):
    """成员（R5：纯数据实体；role/status 取值见注释）。"""

    __tablename__ = "member"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=120)
    email: str = Field(unique=True, index=True, max_length=255)
    role: str = Field(default="Member", max_length=16)  # Owner/Admin/Member/Guest
    team_id: uuid.UUID | None = Field(
        default=None, foreign_key="team.id", ondelete="SET NULL", index=True
    )
    title: str = Field(default="", max_length=120)
    avatar_color: str = Field(default="#3B82C4", max_length=32)
    status: str = Field(default="active", max_length=16)  # active/invited
    timezone: str = Field(default="", max_length=64)
    last_active_at: datetime | None = Field(default=None)


class Project(SQLModel, table=True):
    """项目。成员走 project_member_link，团队 / 负责人为单值外键（原型单值语义）。"""

    __tablename__ = "project"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    key: str = Field(unique=True, index=True, max_length=16)
    name: str = Field(max_length=120)
    status: str = Field(
        default="planning", max_length=16
    )  # planning/active/risk/hold/complete
    icon: str | None = Field(default=None, max_length=64)
    color: str | None = Field(default=None, max_length=32)
    team_id: uuid.UUID | None = Field(
        default=None, foreign_key="team.id", ondelete="SET NULL", index=True
    )
    lead_id: uuid.UUID | None = Field(
        default=None, foreign_key="member.id", ondelete="SET NULL", index=True
    )
    due: date | None = Field(default=None)
    start: date | None = Field(default=None)
    fav: bool = Field(default=False)
    desc: str = Field(default="", max_length=4000)
    milestones: list[dict[str, Any]] = Field(sa_column=_jsonb_array_column())
    private: bool = Field(default=False)
    archived: bool = Field(default=False)
    last_active_at: datetime | None = Field(default=None)
    order: float = Field(sa_column=Column(Double, nullable=False, default=0))


class Task(SQLModel, table=True):
    """任务。依赖与子任务走关联表；排序用 Float8 分数插值（order 列）。"""

    __tablename__ = "task"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    key: str = Field(unique=True, index=True, max_length=24)
    project_id: uuid.UUID = Field(
        foreign_key="project.id", ondelete="CASCADE", index=True
    )
    title: str = Field(max_length=255)
    status: str = Field(
        default="todo", max_length=16
    )  # backlog/todo/progress/review/done
    assignee_id: uuid.UUID | None = Field(
        default=None, foreign_key="member.id", ondelete="SET NULL", index=True
    )
    priority: str = Field(default="none", max_length=16)  # urgent/high/medium/low/none
    due: date | None = Field(default=None)
    start: date | None = Field(default=None)
    labels: list[str] = Field(sa_column=_jsonb_array_column())
    desc: str = Field(default="", max_length=20000)
    estimate: str | None = Field(default=None, max_length=32)
    created_at: datetime = Field(default_factory=get_datetime_utc)
    updated_at: datetime = Field(default_factory=get_datetime_utc)
    order: float = Field(sa_column=Column(Double, nullable=False, default=0))
    fav: bool = Field(default=False)
    recur: str | None = Field(default=None, max_length=32)
    completed_at: datetime | None = Field(default=None)


class Comment(SQLModel, table=True):
    """任务评论；reactions 为弱结构映射（表情 → 成员 id 列表）。"""

    __tablename__ = "comment"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    task_id: uuid.UUID = Field(foreign_key="task.id", ondelete="CASCADE", index=True)
    by_id: uuid.UUID | None = Field(
        default=None, foreign_key="member.id", ondelete="SET NULL", index=True
    )
    at: datetime = Field(default_factory=get_datetime_utc)
    text: str = Field(max_length=10000)
    reactions: dict[str, list[str]] = Field(sa_column=_jsonb_object_column())


class Activity(SQLModel, table=True):
    """项目动态（按天分桶、类型/按人过滤由 PR-4 的查询实现）。"""

    __tablename__ = "activity"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    by_id: uuid.UUID | None = Field(
        default=None, foreign_key="member.id", ondelete="SET NULL", index=True
    )
    verb: str = Field(max_length=64)  # moved/completed/commented on/...（原型动词表）
    task_id: uuid.UUID | None = Field(
        default=None, foreign_key="task.id", ondelete="SET NULL", index=True
    )
    project_id: uuid.UUID = Field(
        foreign_key="project.id", ondelete="CASCADE", index=True
    )
    at: datetime = Field(default_factory=get_datetime_utc)
    extra: str = Field(default="", max_length=512)


class Notif(SQLModel, table=True):
    """通知（R2 四类事件：mention/assign/comment/update）。

    收件人为 ``member_id``；同事件对同一成员去重由
    （type, task_id, member_id）唯一约束兜底（任务为空时 Postgres 默认 NULLS DISTINCT，
    系统类通知不受影响）。
    """

    __tablename__ = "notif"
    __table_args__ = (
        UniqueConstraint(
            "type", "task_id", "member_id", name="uq_notif_type_task_member"
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    type: str = Field(max_length=16)
    by_id: uuid.UUID | None = Field(
        default=None, foreign_key="member.id", ondelete="SET NULL", index=True
    )
    task_id: uuid.UUID | None = Field(
        default=None, foreign_key="task.id", ondelete="SET NULL", index=True
    )
    project_id: uuid.UUID | None = Field(
        default=None, foreign_key="project.id", ondelete="SET NULL", index=True
    )
    member_id: uuid.UUID = Field(
        foreign_key="member.id", ondelete="CASCADE", index=True
    )
    text: str = Field(max_length=255)
    snippet: str = Field(default="", max_length=2000)
    at: datetime = Field(default_factory=get_datetime_utc)
    read: bool = Field(default=False)


class File(SQLModel, table=True):
    """文件元数据（R4b：内容存卷，元数据入库）。

    ``type`` 为展示分类（fig/pdf/zip/img/sheet/doc/code/other，由扩展名推导，
    见原型 ``helpers.js`` 的 ``fileType``），``name`` 保留原始文件名与扩展名。
    """

    __tablename__ = "file"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(
        foreign_key="project.id", ondelete="CASCADE", index=True
    )
    task_id: uuid.UUID | None = Field(
        default=None, foreign_key="task.id", ondelete="SET NULL", index=True
    )
    name: str = Field(max_length=200)
    type: str = Field(max_length=32)
    size_bytes: int = Field(default=0)
    by_id: uuid.UUID | None = Field(
        default=None, foreign_key="member.id", ondelete="SET NULL", index=True
    )
    at: datetime = Field(default_factory=get_datetime_utc)


class Event(SQLModel, table=True):
    """日历事件（R17：title 与 date 必填，time/project 可空）。"""

    __tablename__ = "event"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(max_length=255)
    date: date
    time: str | None = Field(default=None, max_length=8)  # 'HH:MM'
    project_id: uuid.UUID | None = Field(
        default=None, foreign_key="project.id", ondelete="SET NULL", index=True
    )


class SavedView(SQLModel, table=True):
    """项目内保存视图（R18：命名 + 布局 + 过滤条件；不存排序与分组）。"""

    __tablename__ = "saved_view"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(
        foreign_key="project.id", ondelete="CASCADE", index=True
    )
    name: str = Field(max_length=120)
    layout: str = Field(max_length=16)  # list/board/table
    filters: list[dict[str, Any]] = Field(sa_column=_jsonb_array_column())


class Preference(SQLModel, table=True):
    """per-user 偏好（R7）；管理员行的 data 含 ``workspace`` 键（工作区名称/URL，单例语义）。"""

    __tablename__ = "preference"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", ondelete="CASCADE", unique=True, index=True
    )
    data: dict[str, Any] = Field(sa_column=_jsonb_object_column())


class User(SQLModel, table=True):
    """管理员账号（R12：单账号体系；PR-3 落登录/登出/改密与会话 Cookie）。"""

    __tablename__ = "user"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    username: str = Field(unique=True, index=True, max_length=255)
    hashed_password: str = Field(max_length=255)
    owner_member_id: uuid.UUID | None = Field(
        default=None, foreign_key="member.id", ondelete="SET NULL", unique=True
    )


class Subtask(SQLModel, table=True):
    """子任务清单项（轻量实体：无任务 key 与 status；经 ``task_subtask_link`` 唯一挂到一个父任务）。

    原型语义（``subtasks.js``）：清单项仅 title/done/assignee/due/note，
    「转为任务」= 按字段新建任务行后移除本项（``promoteSub``）。
    """

    __tablename__ = "subtask"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(max_length=255)
    done: bool = Field(default=False)
    note: str = Field(default="", max_length=5000)
    assignee_id: uuid.UUID | None = Field(
        default=None, foreign_key="member.id", ondelete="SET NULL", index=True
    )
    due: date | None = Field(default=None)


class ProjectMemberLink(SQLModel, table=True):
    """项目成员关联表（多对多）。"""

    __tablename__ = "project_member_link"

    project_id: uuid.UUID = Field(
        foreign_key="project.id", ondelete="CASCADE", primary_key=True
    )
    member_id: uuid.UUID = Field(
        foreign_key="member.id", ondelete="CASCADE", primary_key=True
    )


class TaskDepLink(SQLModel, table=True):
    """任务依赖关联表：``task`` 依赖 ``depends_on_task``。"""

    __tablename__ = "task_dep_link"

    task_id: uuid.UUID = Field(
        foreign_key="task.id", ondelete="CASCADE", primary_key=True
    )
    depends_on_task_id: uuid.UUID = Field(
        foreign_key="task.id", ondelete="CASCADE", primary_key=True
    )


class TaskSubtaskLink(SQLModel, table=True):
    """父任务 ↔ 子任务关联表；``order`` 用 Float8 分数插值保留清单顺序。

    ``subtask_id`` 唯一：一个子任务只挂一个父任务（原型清单项为任务内嵌对象）。
    删除任务时关联行随任务级联；子任务行由写路径同步删除（PR-4，删除确认文案即含
    「its subtasks」）。
    """

    __tablename__ = "task_subtask_link"
    __table_args__ = (
        UniqueConstraint("subtask_id", name="uq_task_subtask_link_subtask"),
    )

    parent_task_id: uuid.UUID = Field(
        foreign_key="task.id", ondelete="CASCADE", primary_key=True
    )
    subtask_id: uuid.UUID = Field(
        foreign_key="subtask.id", ondelete="CASCADE", primary_key=True
    )
    order: float = Field(sa_column=Column(Double, nullable=False, default=0))
