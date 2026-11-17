"""Server-authoritative initial tasks, frozen per accepted creation intent."""

TEMPLATE_VERSION = "1"

TITLES: dict[str, dict[str, list[str]]] = {
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
