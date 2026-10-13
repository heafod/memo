"""API 层序列化 / 反序列化模型（R11：领域数据 API 契约）。

命名与原型 seed 实体字段对齐（R10 实体形态）；快照形状决策（调度方口径）：
顶层一键一实体数组 + ``preferences``，键名 = members/teams/projects/tasks/subtasks/
comments/activity/notifs/files/events/savedViews——对齐原型消费形态，OpenAPI 即契约。
"""

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

MemberRole = Literal["Owner", "Admin", "Member", "Guest"]
MemberStatus = Literal["active", "invited"]
ProjectStatus = Literal["planning", "active", "risk", "hold", "complete"]
TaskStatus = Literal["backlog", "todo", "progress", "review", "done"]
Priority = Literal["urgent", "high", "medium", "low", "none"]
NotifType = Literal["mention", "assign", "comment", "update", "system"]
SavedViewLayout = Literal["list", "board", "table"]


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
    milestones: list[dict[str, Any]] = Field(default_factory=list)
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
    milestones: list[dict[str, Any]] | None = None
    private: bool | None = None
    archived: bool | None = None
    order: float | None = None
    member_ids: list[uuid.UUID] | None = None


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
    projects: list[ProjectPublic]
    tasks: list[TaskPublic]
    subtasks: list[SubtaskPublic]
    comments: list[CommentPublic]
    activity: list[ActivityPublic]
    notifs: list[NotifPublic]
    files: list[FilePublic]
    events: list[EventPublic]
    savedViews: list[SavedViewPublic]
    preferences: dict[str, Any]
