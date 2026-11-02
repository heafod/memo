"""API 层序列化 / 反序列化模型（R11：领域数据 API 契约）。

命名与原型 seed 实体字段对齐（R10 实体形态）；快照形状决策（调度方口径）：
顶层一键一实体数组 + ``preferences``，键名 = members/teams/projects/tasks/subtasks/
comments/activity/notifs/files/events/savedViews——对齐原型消费形态，OpenAPI 即契约。
"""

import uuid
from datetime import date, datetime
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_serializer,
    field_validator,
)

MemberRole = Literal["Owner", "Admin", "Member", "Guest"]
MemberStatus = Literal["active", "invited"]
ProjectStatus = Literal["planning", "active", "risk", "hold", "complete"]
TaskStatus = Literal["backlog", "todo", "progress", "review", "done"]
Priority = Literal["urgent", "high", "medium", "low", "none"]
NotifType = Literal["mention", "assign", "comment", "update", "system"]
SavedViewLayout = Literal["list", "board", "table"]


class ErrorDetail(BaseModel):
    """错误响应体（中文 detail，R8）；OpenAPI 声明 409 等错误响应用（R29）。"""

    detail: str


class TeamPublic(BaseModel):
    id: uuid.UUID
    name: str
    icon: str | None
    color: str | None
    desc: str


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    icon: str | None = None
    color: str | None = None
    desc: str = ""


class TeamUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    icon: str | None = None
    color: str | None = None
    desc: str | None = None


class MemberPublic(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: str
    team_id: uuid.UUID | None
    title: str
    avatar_color: str
    status: str
    timezone: str
    last_active_at: datetime | None


class MemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    role: MemberRole = "Member"
    team_id: uuid.UUID | None = None
    title: str = ""
    avatar_color: str = "#3B82C4"
    status: MemberStatus = "active"
    timezone: str = ""


class MemberUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = Field(default=None, min_length=3, max_length=255)
    role: MemberRole | None = None
    team_id: uuid.UUID | None = None
    title: str | None = None
    avatar_color: str | None = None
    status: MemberStatus | None = None
    timezone: str | None = None


class ProjectPublic(BaseModel):
    id: uuid.UUID
    key: str
    name: str
    status: str
    icon: str | None
    color: str | None
    team_id: uuid.UUID | None
    lead_id: uuid.UUID | None
    due: date | None
    start: date | None
    fav: bool
    desc: str
    milestones: list[dict[str, Any]]
    private: bool
    archived: bool
    last_active_at: datetime | None
    order: float
    member_ids: list[uuid.UUID]


class ProjectHiddenPublic(BaseModel):
    """快照中不可见项目的裁剪行（R24：canSee 为 false）。

    只保留 id、名称、图标与颜色、负责人，以及判断可见性所需的 ``private`` 与
    ``member_ids``；``member_ids`` 恒为空列表（当前成员不在其中，不下发成员名单）。
    描述、状态、日期、进度、成员、里程碑等其余字段不出现在 JSON 中。
    """

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    name: str
    icon: str | None
    color: str | None
    lead_id: uuid.UUID | None
    private: Literal[True]
    member_ids: list[uuid.UUID]


# 字段名 ``date`` 与类型同名：类体内用别名标注，避免遮蔽（mypy valid-type）
_Date = date


class MilestoneIn(BaseModel):
    """里程碑入参（PR-15b，R25）：只有名称与日期两个字段，不允许额外字段。

    名称去掉首尾空格后 1–80 字；日期按 ISO 字符串落 JSONB，与现有数据
    ``{name, date}`` 同形，``ProjectPublic.milestones`` 输出形状不变。
    """

    model_config = ConfigDict(extra="forbid")

    name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
    ]
    date: _Date

    @field_serializer("date")
    def _date_iso(self, value: _Date) -> str:
        return value.isoformat()


MILESTONES_MAX = 50


class ProjectCreate(BaseModel):
    key: str = Field(min_length=1, max_length=16)
    name: str = Field(min_length=1, max_length=120)
    status: ProjectStatus = "planning"
    icon: str | None = None
    color: str | None = None
    team_id: uuid.UUID | None = None
    lead_id: uuid.UUID | None = None
    due: date | None = None
    start: date | None = None
    fav: bool = False
    desc: str = ""
    milestones: list[MilestoneIn] = Field(
        default_factory=list, max_length=MILESTONES_MAX
    )
    private: bool = False
    member_ids: list[uuid.UUID] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    status: ProjectStatus | None = None
    icon: str | None = None
    color: str | None = None
    team_id: uuid.UUID | None = None
    lead_id: uuid.UUID | None = None
    due: date | None = None
    start: date | None = None
    fav: bool | None = None
    desc: str | None = None
    milestones: list[MilestoneIn] | None = Field(
        default=None, max_length=MILESTONES_MAX
    )
    private: bool | None = None
    archived: bool | None = None
    order: float | None = None
    member_ids: list[uuid.UUID] | None = None

    @field_validator("milestones")
    @classmethod
    def _milestones_not_null(
        cls, value: list[MilestoneIn] | None
    ) -> list[MilestoneIn] | None:
        # AC16（PR-15b，R25）：不传 milestones 时校验器不运行；显式传 null 返回 422，
        # 避免把 JSONB 写成 null 让 /snapshot 500。
        if value is None:
            raise ValueError("milestones 不能为 null")
        return value


class TaskPublic(BaseModel):
    id: uuid.UUID
    key: str
    project_id: uuid.UUID
    title: str
    status: str
    assignee_id: uuid.UUID | None
    priority: str
    due: date | None
    start: date | None
    labels: list[str]
    desc: str
    estimate: str | None
    created_at: datetime
    updated_at: datetime
    order: float
    fav: bool
    recur: str | None
    completed_at: datetime | None
    dep_ids: list[uuid.UUID]


class TaskCreate(BaseModel):
    project_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    status: TaskStatus = "todo"
    assignee_id: uuid.UUID | None = None
    priority: Priority = "none"
    due: date | None = None
    start: date | None = None
    labels: list[str] = Field(default_factory=list)
    desc: str = ""
    estimate: str | None = None
    fav: bool = False
    recur: str | None = None
    dep_ids: list[uuid.UUID] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    status: TaskStatus | None = None
    assignee_id: uuid.UUID | None = None
    priority: Priority | None = None
    due: date | None = None
    start: date | None = None
    labels: list[str] | None = None
    desc: str | None = None
    estimate: str | None = None
    order: float | None = None
    fav: bool | None = None
    recur: str | None = None
    project_id: uuid.UUID | None = None
    dep_ids: list[uuid.UUID] | None = None


class SubtaskPublic(BaseModel):
    id: uuid.UUID
    parent_task_id: uuid.UUID
    title: str
    done: bool
    note: str
    assignee_id: uuid.UUID | None
    due: date | None
    order: float


class CommentPublic(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    by_id: uuid.UUID | None
    at: datetime
    text: str
    reactions: dict[str, list[str]]


class CommentCreate(BaseModel):
    task_id: uuid.UUID
    text: str = Field(min_length=1, max_length=10000)


class CommentUpdate(BaseModel):
    text: str = Field(min_length=1, max_length=10000)


class ActivityPublic(BaseModel):
    id: uuid.UUID
    by_id: uuid.UUID | None
    verb: str
    task_id: uuid.UUID | None
    project_id: uuid.UUID
    at: datetime
    extra: str


class NotifPublic(BaseModel):
    id: uuid.UUID
    type: str
    by_id: uuid.UUID | None
    task_id: uuid.UUID | None
    project_id: uuid.UUID | None
    member_id: uuid.UUID
    text: str
    snippet: str
    at: datetime
    read: bool


class NotifUpdate(BaseModel):
    read: bool


class FilePublic(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    task_id: uuid.UUID | None
    name: str
    type: str
    size_bytes: int
    by_id: uuid.UUID | None
    at: datetime


class EventPublic(BaseModel):
    id: uuid.UUID
    title: str
    date: date
    time: str | None
    project_id: uuid.UUID | None


class EventCreate(BaseModel):
    """事件创建载荷（R17：title/date 必填、time 'HH:MM' 可空、project 可空）。"""

    title: str = Field(min_length=1, max_length=255)
    date: date
    time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    project_id: uuid.UUID | None = None


class EventPut(BaseModel):
    """事件 PUT 全量替换载荷（字段面同创建；省略的 time/project 被清空）。"""

    title: str = Field(min_length=1, max_length=255)
    date: date
    time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    project_id: uuid.UUID | None = None


class SavedViewPublic(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    layout: str
    filters: list[dict[str, Any]]


class SavedViewCreate(BaseModel):
    """保存视图创建载荷（R18：命名 + 布局 + 过滤条件；排序与分组不收）。

    filters 只做「对象数组」轻校验（结构以原型为源，不逐键 schema 化——
    口径同 PR-4 偏好 JSONB 取舍）。
    """

    project_id: uuid.UUID
    name: str = Field(min_length=1, max_length=120)
    layout: SavedViewLayout
    filters: list[dict[str, Any]] = Field(default_factory=list)


class SavedViewPut(BaseModel):
    """保存视图 PUT 全量替换载荷（重命名 + 布局/过滤整体替换；project 不可改）。"""

    name: str = Field(min_length=1, max_length=120)
    layout: SavedViewLayout
    filters: list[dict[str, Any]] = Field(default_factory=list)


class PreferencesPublic(BaseModel):
    data: dict[str, Any]


class PreferencesUpdate(BaseModel):
    data: dict[str, Any]


class Snapshot(BaseModel):
    """全量快照（R11）：R10 全实体 + 当前用户偏好，不分页（种子级规模口径）。"""

    members: list[MemberPublic]
    teams: list[TeamPublic]
    # R24：可见项目为完整行（已归档的带 archived: true）；不可见项目为裁剪行
    projects: list[ProjectPublic | ProjectHiddenPublic]
    tasks: list[TaskPublic]
    subtasks: list[SubtaskPublic]
    comments: list[CommentPublic]
    activity: list[ActivityPublic]
    notifs: list[NotifPublic]
    files: list[FilePublic]
    events: list[EventPublic]
    savedViews: list[SavedViewPublic]
    preferences: dict[str, Any]
