"""初始数据入口（R13）。

种子数据（成员/项目/任务/评论/动态/通知/文件/事件/保存视图 + 管理员账号）在 PR-3/PR-4
落盘；本入口保持幂等，供 scripts/prestart.sh 与 compose 启动链路调用。
"""

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init() -> None:
    """幂等灌入初始数据（骨架阶段为空实现，PR-3 起按环境变量创建管理员并关联 Owner 成员）。"""


def main() -> None:
    logger.info("Running initial data")
    init()
    logger.info("Initial data done")


if __name__ == "__main__":
    main()
