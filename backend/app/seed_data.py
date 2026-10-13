"""演示种子数据模块（R13：从 ``prototype/src/data/seed.js`` 只读提炼，不改 prototype/）。

时间语义对齐原型（``core/utils.js``）：
- ``dOff(n)``  = 今日 + n 天（本地日历日口径；后端以 UTC 日历日近似，展示层按日粒度消费）；
- ``minsAgo(m)`` = 当前时刻 − m 分钟（原型为毫秒时间戳，后端落 UTC datetime）。

结构说明：
- 原型内联于任务的 ``subtasks`` 在此展开为 (task_ref, subtask) 两元组，
  由 ``initial_data.py`` 经 ``task_subtask_link`` 挂接（order 取种子顺序 × 1024）；
- 任务 ``attachments`` 与 files 表同源于原型 ``files`` 数组（原型两处重复登记，
  后端只落 files 元数据行，内容与下载端点是 PR-6）；
- 团队取自原型 ``TEAMS_SEED``（``core/constants.js``）；项目颜色名为保留语义原样
  落库（indigo/blue/…，前端经映射表消费）；
- notifs 中原型 ``by: null`` 且无 task 的系统类条目（n6 项目风险、n10 到期提醒）
  落库 type="system"——R2 事件集四类不含系统类，系统通知不定时产生、仅种子；
- 幂等由 ``initial_data.py`` 按自然键判重（member.email、project.key、task.key、
  team.name、event(title,date)、saved_view(project_id,name) 等），本模块只提供数据。

键命名：原型实体 id（m1/p1/t3/…）仅作种子内部引用（ref），落库后由后端分配 UUID。
"""

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta


def d_off(days: int) -> date:
    """原型 dOff：今日（UTC 日历日）+ n 天。"""
    return datetime.now(UTC).date() + timedelta(days=days)


def mins_ago(minutes: int) -> datetime:
    """原型 minsAgo：当前 UTC 时刻 − n 分钟。"""
    return datetime.now(UTC) - timedelta(minutes=minutes)


@dataclass(frozen=True)
class TeamSeed:
    ref: str
    name: str
    icon: str
    color: str
    desc: str


@dataclass(frozen=True)
class MemberSeed:
    ref: str
    name: str
    email: str
    role: str
    team_ref: str
    title: str
    avatar_color: str
    status: str
    last_active_minutes: int | None
    timezone: str


@dataclass(frozen=True)
class ProjectSeed:
    ref: str
    key: str
    name: str
    icon: str | None
    color: str | None
    status: str
    team_ref: str
    lead_ref: str
    due_offset: int
    start_offset: int
    fav: bool
    member_refs: list[str]
    desc: str
    milestones: list[dict[str, str]]
    private: bool = False
    archived: bool = False
    last_active_minutes: int | None = None


@dataclass(frozen=True)
class SubtaskSeed:
    title: str
    done: bool = False


@dataclass(frozen=True)
class TaskSeed:
    ref: str
    project_ref: str
    key: str
    title: str
    status: str
    assignee_ref: str | None
    priority: str
    due_offset: int | None
    start_offset: int | None
    labels: list[str]
    estimate: str | None
    created_minutes: int
    updated_minutes: int
    order: float
    fav: bool = False
    recur: str | None = None
    desc: str = ""
    subtasks: list[SubtaskSeed] = field(default_factory=list)
    dep_refs: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class CommentSeed:
    task_ref: str
    by_ref: str
    at_minutes: int
    text: str
    reactions: dict[str, list[str]]


@dataclass(frozen=True)
class ActivitySeed:
    by_ref: str
    verb: str
    task_ref: str | None
    project_ref: str
    at_minutes: int
    extra: str = ""


@dataclass(frozen=True)
class NotifSeed:
    type: str
    by_ref: str | None
    task_ref: str | None
    project_ref: str | None
    member_ref: str  # 收件人（原型 me=m1；系统类同）
    text: str
    snippet: str
    at_minutes: int
    read: bool


@dataclass(frozen=True)
class FileSeed:
    project_ref: str
    name: str
    type: str
    size_bytes: int
    by_ref: str
    at_minutes: int
    task_ref: str | None = None


@dataclass(frozen=True)
class EventSeed:
    title: str
    date_offset: int
    time: str | None
    project_ref: str


@dataclass(frozen=True)
class SavedViewSeed:
    project_ref: str
    name: str
    layout: str
    filters: list[dict[str, object]]


# ---------- 团队（TEAMS_SEED，core/constants.js） ----------

TEAMS: list[TeamSeed] = [
    TeamSeed("design", "设计", "palette", "#8662C9", "产品设计、品牌与用户研究"),
    TeamSeed("eng", "工程", "code", "#3B82C4", "Web、移动端与平台工程"),
    TeamSeed("mkt", "市场", "megaphone", "#C54B78", "市场活动、内容与增长"),
    TeamSeed("product", "产品", "target", "#C48A1E", "路线图、规划与测试"),
]

# ---------- 成员（seed.js members） ----------

MEMBERS: list[MemberSeed] = [
    MemberSeed(
        "m1",
        "林一舟",
        "hello@memo.app",
        "Owner",
        "product",
        "产品负责人",
        "#5A67D8",
        "active",
        0,
        "杭州",
    ),
    MemberSeed(
        "m2",
        "陈莎莎",
        "sarah@memo.app",
        "Admin",
        "design",
        "设计负责人",
        "#C54B78",
        "active",
        4,
        "上海",
    ),
    MemberSeed(
        "m3",
        "张伟",
        "john@memo.app",
        "Member",
        "eng",
        "前端工程师",
        "#3B82C4",
        "active",
        22,
        "北京",
    ),
    MemberSeed(
        "m4",
        "王悦",
        "emma@memo.app",
        "Member",
        "design",
        "产品设计师",
        "#23918A",
        "active",
        9,
        "成都",
    ),
    MemberSeed(
        "m5",
        "李安琪",
        "priya@memo.app",
        "Member",
        "mkt",
        "内容策划",
        "#C48A1E",
        "active",
        95,
        "广州",
    ),
    MemberSeed(
        "m6",
        "刘一鸣",
        "marcus@memo.app",
        "Member",
        "eng",
        "后端工程师",
        "#8662C9",
        "active",
        240,
        "深圳",
    ),
    MemberSeed(
        "m7",
        "赵倩",
        "lena@memo.app",
        "Admin",
        "product",
        "测试负责人",
        "#3D8E5F",
        "active",
        1500,
        "南京",
    ),
    MemberSeed(
        "m8",
        "董博文",
        "diego@freelance.io",
        "Guest",
        "mkt",
        "自由撰稿人",
        "#C0612B",
        "invited",
        None,
        "马德里",
    ),
]

# ---------- 项目（seed.js projects） ----------

PROJECTS: list[ProjectSeed] = [
    ProjectSeed(
        "p1",
        "WEB",
        "官网改版",
        "globe",
        "indigo",
        "active",
        "design",
        "m2",
        24,
        -30,
        True,
        ["m1", "m2", "m3", "m4", "m5", "m6", "m7"],
        "重构 memo.app 官网：梳理信息架构，搭建响应式组件库，并把博客迁移到更快的 CMS。",
        [
            {"name": "线框图定稿", "date": str(d_off(2))},
            {"name": "开发交接", "date": str(d_off(14))},
            {"name": "正式上线", "date": str(d_off(24))},
        ],
        last_active_minutes=12,
    ),
    ProjectSeed(
        "p2",
        "MOB",
        "移动端 App",
        "smartphone",
        "blue",
        "active",
        "eng",
        "m3",
        52,
        -45,
        True,
        ["m1", "m3", "m4", "m6", "m7"],
        "面向外勤团队的 iOS / Android 原生客户端，支持离线同步、推送通知和生物识别登录。",
        [
            {"name": "Beta 版构建", "date": str(d_off(9))},
            {"name": "应用商店提审", "date": str(d_off(45))},
        ],
        last_active_minutes=48,
    ),
    ProjectSeed(
        "p3",
        "MKT",
        "市场推广",
        "megaphone",
        "rose",
        "planning",
        "mkt",
        "m5",
        40,
        -10,
        False,
        ["m1", "m4", "m5", "m7", "m8"],
        "Q4 品牌认知活动：覆盖付费社交、邮件营销，以及面向运营负责人的发布 Webinar。",
        [
            {"name": "创意定稿", "date": str(d_off(12))},
            {"name": "活动上线", "date": str(d_off(21))},
        ],
        last_active_minutes=130,
    ),
    ProjectSeed(
        "p4",
        "LCH",
        "产品发布",
        "rocket",
        "amber",
        "risk",
        "product",
        "m1",
        12,
        -21,
        False,
        ["m1", "m2", "m3", "m5", "m7"],
        "统筹 Workflows 2.0 发布：定价、文档、媒体宣传与销售赋能，跨团队协同推进。",
        [
            {"name": "上线决策会", "date": str(d_off(11))},
            {"name": "发布日", "date": str(d_off(12))},
        ],
        last_active_minutes=35,
    ),
    ProjectSeed(
        "p5",
        "DS",
        "设计系统",
        "component",
        "violet",
        "active",
        "design",
        "m2",
        70,
        -60,
        False,
        ["m2", "m3", "m4"],
        "Web 与移动端团队共用的设计令牌、组件和使用文档。",
        [{"name": "v2 设计令牌", "date": str(d_off(3))}],
        last_active_minutes=300,
    ),
    ProjectSeed(
        "p6",
        "CP",
        "客户门户",
        "building-2",
        "teal",
        "hold",
        "eng",
        "m6",
        90,
        -5,
        False,
        ["m6", "m7"],
        "面向企业客户的自助计费与支持门户。合同评审期间暂缓推进，仅限相关成员访问。",
        [],
        private=True,
        last_active_minutes=2880,
    ),
    ProjectSeed(
        "p7",
        "MW",
        "营销官网",
        "layout-grid",
        "green",
        "complete",
        "mkt",
        "m5",
        -18,
        -80,
        False,
        ["m1", "m3", "m5"],
        "春季版本的发布官网。已上线并移交 Web 团队维护。",
        [],
        last_active_minutes=26000,
    ),
]

# ---------- 任务（seed.js 的 t(...) 调用序列，key 与原型同公式生成） ----------
# 原型 key 公式：proj.key + '-' + (100 + count * 3)，count 为该项目内第几个任务。


def _t(
    project_ref: str,
    key: str,
    title: str,
    status: str,
    assignee_ref: str | None,
    priority: str,
    due: int | None,
    labels: list[str] | None = None,
    *,
    est: str | None = None,
    length: int = 4,
    age: int = 12,
    upd: int = 30,
    fav: bool = False,
    recur: str | None = None,
    desc: str = "",
    subtasks: list[SubtaskSeed] | None = None,
    deps: list[str] | None = None,
    order: float,
) -> TaskSeed:
    ref = f"t{key}"
    return TaskSeed(
        ref=ref,
        project_ref=project_ref,
        key=key,
        title=title,
        status=status,
        assignee_ref=assignee_ref,
        priority=priority,
        due_offset=due,
        start_offset=(due - length) if due is not None else None,
        labels=labels or [],
        estimate=est,
        created_minutes=60 * 24 * age,
        updated_minutes=60 * upd,
        order=order,
        fav=fav,
        recur=recur,
        desc=desc,
        subtasks=subtasks or [],
        dep_refs=deps or [],
    )


TASKS: list[TaskSeed] = [
    # 官网改版（p1/WEB）
    _t(
        "p1",
        "WEB-103",
        "梳理现有导航",
        "done",
        "m2",
        "high",
        -12,
        ["research"],
        est="2d",
        length=5,
        age=28,
        order=1,
    ),
    _t(
        "p1",
        "WEB-106",
        "整理干系人访谈要点",
        "done",
        "m1",
        "medium",
        -9,
        ["research"],
        est="1d",
        age=26,
        order=2,
    ),
    _t(
        "p1",
        "WEB-109",
        "设计首页线框图",
        "review",
        "m2",
        "high",
        1,
        ["design"],
        est="3d",
        length=7,
        fav=True,
        desc=(
            "<p>新首页的低保真线框图，覆盖<b>桌面、平板与移动端</b>三档断点。</p>"
            "<ul><li>首屏：突出产品价值主张</li><li>客户 Logo 与典型案例</li>"
            "<li>功能总览，可跳转至各产品页</li></ul><p>信息架构决策请参考导航梳理的结论。</p>"
        ),
        subtasks=[
            SubtaskSeed("桌面端布局", True),
            SubtaskSeed("平板端布局", True),
            SubtaskSeed("移动端布局", True),
            SubtaskSeed("标注交互说明"),
        ],
        order=3,
    ),
    _t(
        "p1",
        "WEB-112",
        "确定导航方案",
        "progress",
        "m3",
        "high",
        0,
        ["design", "frontend"],
        est="2d",
        subtasks=[
            SubtaskSeed("主导航结构", True),
            SubtaskSeed("超级菜单内容"),
            SubtaskSeed("移动端抽屉交互"),
        ],
        order=4,
    ),
    _t(
        "p1",
        "WEB-115",
        "设计响应式导航",
        "progress",
        "m4",
        "medium",
        3,
        ["design"],
        est="3d",
        length=6,
        subtasks=[SubtaskSeed("断点规则", True), SubtaskSeed("吸顶导航状态")],
        order=5,
    ),
    _t(
        "p1",
        "WEB-118",
        "准备设计令牌",
        "todo",
        "m1",
        "medium",
        6,
        ["design"],
        est="2d",
        order=6,
    ),
    _t(
        "p1",
        "WEB-121",
        "评审响应式布局",
        "todo",
        "m4",
        "medium",
        8,
        ["qa", "design"],
        est="1d",
        length=3,
        order=7,
    ),
    _t(
        "p1",
        "WEB-124",
        "准备开发交接",
        "todo",
        "m2",
        "high",
        14,
        ["frontend"],
        est="2d",
        deps=["WEB-109", "WEB-115"],
        order=8,
    ),
    _t(
        "p1",
        "WEB-127",
        "设计移动端新手引导",
        "progress",
        "m4",
        "urgent",
        -1,
        ["design"],
        est="3d",
        length=6,
        subtasks=[
            SubtaskSeed("欢迎页", True),
            SubtaskSeed("权限申请弹窗"),
            SubtaskSeed("空状态页"),
        ],
        order=9,
    ),
    _t(
        "p1",
        "WEB-130",
        "撰写首页文案",
        "backlog",
        "m5",
        "low",
        18,
        ["content"],
        est="2d",
        order=10,
    ),
    _t(
        "p1",
        "WEB-133",
        "配置埋点事件",
        "backlog",
        "m6",
        "medium",
        20,
        ["backend", "growth"],
        est="1d",
        order=11,
    ),
    _t(
        "p1",
        "WEB-136",
        "模板页无障碍审计",
        "backlog",
        "m7",
        "high",
        22,
        ["qa"],
        est="2d",
        order=12,
    ),
    _t(
        "p1",
        "WEB-139",
        "开发首屏 Hero 组件",
        "todo",
        "m3",
        "medium",
        10,
        ["frontend"],
        est="2d",
        length=3,
        deps=["WEB-109"],
        order=13,
    ),
    _t(
        "p1",
        "WEB-142",
        "图片优化流水线",
        "review",
        "m6",
        "low",
        2,
        ["backend"],
        est="1d",
        length=5,
        order=14,
    ),
    _t(
        "p1",
        "WEB-145",
        "每周设计同步纪要",
        "todo",
        "m1",
        "low",
        2,
        ["content"],
        recur="Weekly",
        est="30m",
        length=0,
        order=15,
    ),
    _t(
        "p1",
        "WEB-148",
        "博客迁移至新 CMS",
        "backlog",
        "m3",
        "medium",
        28,
        ["backend"],
        est="5d",
        length=8,
        order=16,
    ),
    _t(
        "p1",
        "WEB-151",
        "页脚与法务页面",
        "done",
        "m5",
        "low",
        -5,
        ["frontend"],
        est="1d",
        order=17,
    ),
    _t(
        "p1",
        "WEB-154",
        "修复定价页锚点失效",
        "done",
        "m3",
        "medium",
        -3,
        ["bug"],
        est="2h",
        length=1,
        order=18,
    ),
    # 移动端 App（p2/MOB）
    _t(
        "p2",
        "MOB-103",
        "新手引导流程原型",
        "progress",
        "m4",
        "high",
        4,
        ["design"],
        est="3d",
        length=6,
        order=19,
    ),
    _t(
        "p2",
        "MOB-106",
        "推送通知服务",
        "progress",
        "m6",
        "high",
        6,
        ["backend"],
        est="5d",
        length=9,
        order=20,
    ),
    _t(
        "p2",
        "MOB-109",
        "离线模式数据同步",
        "todo",
        "m3",
        "urgent",
        5,
        ["frontend", "backend"],
        est="8d",
        length=10,
        deps=["MOB-106"],
        order=21,
    ),
    _t(
        "p2",
        "MOB-112",
        "App Store 应用截图",
        "backlog",
        "m5",
        "low",
        40,
        ["content"],
        est="1d",
        order=22,
    ),
    _t(
        "p2",
        "MOB-115",
        "接入崩溃上报",
        "done",
        "m6",
        "medium",
        -8,
        ["backend"],
        est="1d",
        order=23,
    ),
    _t(
        "p2",
        "MOB-118",
        "生物识别登录",
        "review",
        "m3",
        "high",
        2,
        ["frontend"],
        est="3d",
        length=6,
        order=24,
    ),
    _t(
        "p2",
        "MOB-121",
        "设置页改版",
        "todo",
        "m4",
        "medium",
        9,
        ["design"],
        est="2d",
        order=25,
    ),
    _t(
        "p2",
        "MOB-124",
        "分流 Beta 用户反馈",
        "todo",
        "m1",
        "medium",
        0,
        ["research"],
        est="4h",
        length=1,
        recur="Weekly",
        order=26,
    ),
    _t(
        "p2",
        "MOB-127",
        "修复安卓 12 横屏崩溃",
        "todo",
        "m3",
        "urgent",
        1,
        ["bug"],
        est="1d",
        length=1,
        order=27,
    ),
    # 市场推广（p3/MKT）
    _t(
        "p3",
        "MKT-103",
        "推广活动简报",
        "done",
        "m5",
        "medium",
        -6,
        ["content"],
        est="1d",
        order=28,
    ),
    _t(
        "p3",
        "MKT-106",
        "落地页文案",
        "progress",
        "m5",
        "medium",
        4,
        ["content"],
        est="2d",
        order=29,
    ),
    _t(
        "p3",
        "MKT-109",
        "付费社交素材",
        "todo",
        "m4",
        "high",
        7,
        ["design", "growth"],
        est="3d",
        length=5,
        order=30,
    ),
    _t(
        "p3",
        "MKT-112",
        "邮件培育序列",
        "todo",
        "m8",
        "medium",
        9,
        ["content"],
        est="2d",
        order=31,
    ),
    _t(
        "p3",
        "MKT-115",
        "达人合作名单",
        "backlog",
        "m7",
        "low",
        None,
        ["growth"],
        order=32,
    ),
    _t(
        "p3",
        "MKT-118",
        "发布 Webinar 幻灯片",
        "todo",
        "m1",
        "medium",
        15,
        ["content"],
        est="2d",
        order=33,
    ),
    _t(
        "p3",
        "MKT-121",
        "预算审批",
        "review",
        "m1",
        "urgent",
        -2,
        [],
        est="1h",
        length=1,
        order=34,
    ),
    # 产品发布（p4/LCH）
    _t(
        "p4",
        "LCH-103",
        "发布准备清单",
        "progress",
        "m1",
        "urgent",
        3,
        ["qa"],
        est="1d",
        length=10,
        subtasks=[
            SubtaskSeed("文档已发布", True),
            SubtaskSeed("定价已生效"),
            SubtaskSeed("客服培训完成"),
            SubtaskSeed("状态页已更新", True),
        ],
        order=35,
    ),
    _t(
        "p4",
        "LCH-106",
        "更新定价页",
        "todo",
        "m2",
        "high",
        6,
        ["design", "frontend"],
        est="2d",
        order=36,
    ),
    _t(
        "p4",
        "LCH-109",
        "撰写发布新闻稿",
        "review",
        "m5",
        "medium",
        1,
        ["content"],
        est="1d",
        order=37,
    ),
    _t(
        "p4",
        "LCH-112",
        "销售赋能文档",
        "todo",
        "m7",
        "medium",
        8,
        ["content"],
        est="2d",
        order=38,
    ),
    _t(
        "p4",
        "LCH-115",
        "编写更新日志",
        "backlog",
        "m3",
        "low",
        11,
        ["content"],
        est="4h",
        order=39,
    ),
    _t(
        "p4",
        "LCH-118",
        "上线决策会",
        "todo",
        "m1",
        "high",
        11,
        [],
        est="1h",
        length=0,
        order=40,
    ),
    # 设计系统（p5/DS）
    _t(
        "p5",
        "DS-103",
        "色彩令牌 v2",
        "done",
        "m2",
        "high",
        -4,
        ["design"],
        est="3d",
        order=41,
    ),
    _t(
        "p5",
        "DS-106",
        "按钮组件梳理",
        "progress",
        "m2",
        "medium",
        5,
        ["design", "frontend"],
        est="2d",
        order=42,
    ),
    _t(
        "p5",
        "DS-109",
        "表单控件状态",
        "todo",
        "m4",
        "medium",
        12,
        ["design"],
        est="3d",
        order=43,
    ),
    _t(
        "p5", "DS-112", "图标库清理", "backlog", "m4", "low", None, ["design"], order=44
    ),
    _t(
        "p5",
        "DS-115",
        "文档站点",
        "todo",
        "m3",
        "medium",
        20,
        ["frontend"],
        est="5d",
        length=8,
        order=45,
    ),
    _t(
        "p5",
        "DS-118",
        "深色模式配色",
        "review",
        "m2",
        "high",
        2,
        ["design"],
        est="2d",
        order=46,
    ),
    # 营销官网（p7/MW，已完成）
    _t("p7", "MW-103", "上线前 QA 验收", "done", "m3", "high", -20, ["qa"], order=47),
    _t(
        "p7",
        "MW-106",
        "春季版本首屏视频",
        "done",
        "m5",
        "medium",
        -24,
        ["content"],
        order=48,
    ),
    # 客户门户（p6/CP，受限）
    _t(
        "p6", "CP-103", "计费 API 契约", "todo", "m6", "high", 30, ["backend"], order=49
    ),
]

# 原型种子完成后 t3（WEB-109）的 updated 被改写为 38 分钟前
_TASK_UPDATED_OVERRIDES: dict[str, int] = {"WEB-109": 38}

# 原型完成时间元数据：done 任务按生成顺序 completedAt = minsAgo(60 * (6 + i * 17))
DONE_COMPLETED_MINUTES: dict[str, int] = {}
_done_index = 0
for _task in TASKS:
    if _task.status == "done":
        DONE_COMPLETED_MINUTES[_task.key] = 60 * (6 + _done_index * 17)
        _done_index += 1

# ---------- 评论（seed.js comments） ----------

COMMENTS: list[CommentSeed] = [
    CommentSeed(
        "WEB-109",
        "m4",
        260,
        "平板端布局在 Logo 那一排显得有点挤，1024px 以下能不能只保留四个 Logo？",
        {"👍": ["m2", "m3"]},
    ),
    CommentSeed(
        "WEB-109",
        "m2",
        210,
        "有道理，v3 已经更新——@林一舟 周四前能帮忙看一版吗？",
        {},
    ),
    CommentSeed(
        "WEB-109",
        "m3",
        95,
        "首屏间距完全对齐了我们的 8pt 栅格，工程侧没有阻塞。",
        {"🎉": ["m2"]},
    ),
    CommentSeed(
        "WEB-112",
        "m3",
        400,
        "超级菜单的内容市场部还没给，我先放了占位内容。",
        {},
    ),
    CommentSeed(
        "WEB-112",
        "m5",
        120,
        "@张伟 内容已经放进共享文档了——最多六列。",
        {"👍": ["m3"]},
    ),
    CommentSeed(
        "WEB-127",
        "m1",
        55,
        "这个昨天已经延期了——@王悦 权限申请弹窗那边有什么卡点吗？",
        {},
    ),
    CommentSeed(
        "MOB-118",
        "m7",
        700,
        "Face ID 验证失败后降级到密码解锁，在 iOS 17 上没问题；接下来测安卓。",
        {},
    ),
    CommentSeed(
        "MKT-121",
        "m2",
        1500,
        "财务要求先看到渠道预算拆分才能审批。",
        {},
    ),
    CommentSeed(
        "LCH-103",
        "m7",
        200,
        "客服培训改到下周一了。@林一舟 麻烦确认一下状态页的文案。",
        {},
    ),
]

# ---------- 动态（seed.js activity） ----------

ACTIVITIES: list[ActivitySeed] = [
    ActivitySeed("m2", "moved", "WEB-109", "p1", 38, "to Review"),
    ActivitySeed("m3", "completed", "WEB-154", "p1", 90),
    ActivitySeed("m4", "commented on", "MOB-103", "p2", 140),
    ActivitySeed("m1", "changed priority of", "WEB-127", "p1", 180, "to Urgent"),
    ActivitySeed("m6", "added a file to", "WEB-142", "p1", 260, "品牌素材包.zip"),
    ActivitySeed("m5", "created", "MKT-109", "p3", 330),
    ActivitySeed("m2", "assigned", "WEB-124", "p1", 420, "to 陈莎莎"),
    ActivitySeed("m7", "completed", "MOB-115", "p2", 1300),
    ActivitySeed("m3", "moved", "MOB-118", "p2", 1500, "to Review"),
    ActivitySeed("m1", "created project", None, "p4", 30000),
    ActivitySeed("m2", "created project", None, "p1", 43000),
    ActivitySeed("m4", "completed", "DS-103", "p5", 5600),
    ActivitySeed("m5", "completed", "WEB-151", "p1", 7200),
]

# ---------- 通知（seed.js notifs；收件人为原型 me=m1；by 为空且无 task 的为系统类） ----------

NOTIFS: list[NotifSeed] = [
    NotifSeed(
        "mention",
        "m2",
        "WEB-109",
        None,
        "m1",
        "mentioned you in",
        "有道理，v3 已经更新——@林一舟 周四前能帮忙看一版吗？",
        210,
        False,
    ),
    NotifSeed(
        "assign",
        "m3",
        "MOB-124",
        None,
        "m1",
        "assigned you",
        "今天到期 · 中优先级",
        300,
        False,
    ),
    NotifSeed(
        "comment",
        "m4",
        "WEB-127",
        None,
        "m1",
        "commented on",
        "权限申请弹窗需要法务审核——文案正在起草。",
        40,
        False,
    ),
    NotifSeed(
        "mention",
        "m7",
        "LCH-103",
        None,
        "m1",
        "mentioned you in",
        "客服培训改到下周一了。@林一舟 麻烦确认一下状态页的文案。",
        200,
        False,
    ),
    NotifSeed(
        "update",
        "m2",
        "WEB-109",
        None,
        "m1",
        "moved to Review",
        "待处理 → 审核中",
        38,
        True,
    ),
    NotifSeed(
        "system",
        None,
        None,
        "p4",
        "m1",
        "Product Launch is at risk",
        "本周有 3 个任务还未开始",
        600,
        False,
    ),
    NotifSeed(
        "comment",
        "m2",
        "MKT-121",
        None,
        "m1",
        "commented on",
        "财务要求先看到渠道预算拆分才能审批。",
        1500,
        True,
    ),
    NotifSeed(
        "assign",
        "m2",
        "WEB-118",
        None,
        "m1",
        "assigned you",
        "6 天后到期",
        2900,
        True,
    ),
    NotifSeed(
        "update",
        "m3",
        "WEB-154",
        None,
        "m1",
        "completed",
        "修复定价页锚点失效",
        90,
        True,
    ),
    NotifSeed(
        "system",
        None,
        "MOB-124",
        None,
        "m1",
        "is due today",
        "分流 Beta 用户反馈",
        20,
        False,
    ),
]

# ---------- 文件元数据（seed.js files；内容存卷是 PR-6，本批仅元数据行） ----------
# 原型 size 为展示字符串（'4.2 MB'/'860 KB'），后端 size_bytes 为估算换算值。

FILES: list[FileSeed] = [
    FileSeed("p1", "首页线框图-v3.fig", "fig", 4_400_000, "m2", 300, "WEB-109"),
    FileSeed("p1", "导航梳理结论.pdf", "pdf", 880_000, "m2", 8000, "WEB-109"),
    FileSeed("p1", "品牌摄影素材包.zip", "zip", 134_200_000, "m4", 3000),
    FileSeed("p1", "首屏方案探索.png", "img", 2_200_000, "m4", 1400),
    FileSeed("p1", "内容清单.xlsx", "sheet", 320_000, "m5", 9000),
    FileSeed("p1", "站点地图-v2.pdf", "pdf", 550_000, "m1", 12000),
    FileSeed("p1", "用户访谈记录.docx", "doc", 98_000, "m1", 20000),
    FileSeed("p1", "埋点事件.json", "code", 12_000, "m6", 700),
    FileSeed("p2", "新手引导流程.fig", "fig", 7_100_000, "m4", 500),
    FileSeed("p2", "Beta 反馈汇总.xlsx", "sheet", 225_000, "m1", 900),
    FileSeed("p3", "推广活动简报.pdf", "pdf", 1_150_000, "m5", 4000),
    FileSeed("p4", "发布计划.docx", "doc", 184_000, "m1", 6000),
]

# ---------- 日历事件（seed.js events） ----------

EVENTS: list[EventSeed] = [
    EventSeed("设计评审", 1, "10:00", "p1"),
    EventSeed("迭代计划会", 5, "09:30", "p2"),
    EventSeed("发布同步会", 0, "15:00", "p4"),
    EventSeed("干系人演示", 9, "14:00", "p1"),
    EventSeed("推广启动会", -3, "11:00", "p3"),
    EventSeed("迭代复盘会", 12, "16:00", "p2"),
]

# ---------- 保存视图（seed.js savedViews；R18 种子「高优先级」：list 布局 + urgent/high 过滤） ----------

SAVED_VIEWS: list[SavedViewSeed] = [
    SavedViewSeed(
        "p1",
        "高优先级",
        "list",
        [{"f": "priority", "op": "is", "v": ["urgent", "high"]}],
    ),
]

# ---------- 工作区（seed.js ws；管理员 preferences 的 workspace 键，单例语义） ----------

WORKSPACE: dict[str, str] = {"name": "Memo", "url": "memo", "color": "#1D1C1A"}
