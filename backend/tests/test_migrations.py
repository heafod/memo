"""迁移升降级可重复执行 + 表结构与关系自审（R10、R15）。

覆盖：

- ``alembic upgrade head`` 可重复执行（连续两次为无操作）；
- ``alembic downgrade base`` 后领域表全部消失、再次 ``upgrade head`` 可复原
  （可回滚、可重放，R15）；
- 表结构与关系自审清单（PR-2 建模约定逐条落为断言，R10）：

  1. 领域实体表 + 账号 / 偏好 / 关联表齐备：team、member、project、task、subtask、comment、
     activity、notif、file、event、saved_view、user、preference、
     project_member_link、task_dep_link、task_subtask_link（共 16 张）；
  2. 关系字段用关联表：project_member_link（项目↔成员）、task_dep_link（任务↔被依赖任务）、
     task_subtask_link（父任务↔子任务清单项，含顺序列，子任务唯一挂一个父任务）；
  3. 弱结构数组用 JSONB：task.labels、project.milestones、comment.reactions、
     saved_view.filters、preference.data；
  4. 排序用 Float8（DOUBLE PRECISION）：task.order、project.order、
     task_subtask_link.order；
  5. notif 去重约束：``(type, task_id, member_id)`` 唯一；
  6. users 表 ``owner_member_id`` 关联 Owner 成员（外键指向 member.id，且唯一）；
  7. 工作区名称 / URL 不新增表：由 preference.data 的 ``workspace`` 键承载，结构上不存在
     workspace 表。

已知边界：notif 唯一约束在 task_id 为 NULL（系统类通知）时不生效（Postgres NULLS DISTINCT），
与 R2「系统类通知仅种子」一致；对「同一任务多次评论」的折叠语义由 PR-4 投递口径验证承接。
"""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.dialects.postgresql import JSONB

from app.core.db import engine

BACKEND_DIR = Path(__file__).resolve().parents[1]

DOMAIN_TABLES = {
    "team",
    "member",
    "project",
    "task",
    "subtask",
    "comment",
    "activity",
    "notif",
    "file",
    "event",
    "saved_view",
    "user",
    "preference",
    "project_member_link",
    "task_dep_link",
    "task_subtask_link",
}


def _alembic_config() -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "app" / "alembic"))
    return config


def _table_names() -> set[str]:
    with engine.connect() as connection:
        return set(inspect(connection).get_table_names())


def test_migration_upgrade_downgrade_repeatable() -> None:  # R15
    config = _alembic_config()

    command.downgrade(config, "base")  # 起点归零（空库时为无操作）
    assert _table_names().isdisjoint(DOMAIN_TABLES)

    command.upgrade(config, "head")
    assert DOMAIN_TABLES <= _table_names()

    command.upgrade(config, "head")  # 可重复执行：第二次为无操作
    assert DOMAIN_TABLES <= _table_names()

    command.downgrade(config, "base")  # 可回滚
    assert _table_names().isdisjoint(DOMAIN_TABLES)

    command.upgrade(config, "head")  # 复原，供结构与后续批次使用
    assert DOMAIN_TABLES <= _table_names()


def test_schema_structure_audit() -> None:  # R10
    command.upgrade(_alembic_config(), "head")

    with engine.connect() as connection:
        inspector = inspect(connection)

        names = set(inspector.get_table_names())
        assert DOMAIN_TABLES <= names
        assert names - DOMAIN_TABLES <= {"alembic_version"}

        def column_type(table: str, column: str) -> object:
            return next(
                col["type"]
                for col in inspector.get_columns(table)
                if col["name"] == column
            )

        # 2. 关系字段用关联表
        for link_table in (
            "project_member_link",
            "task_dep_link",
            "task_subtask_link",
        ):
            assert link_table in names

        # 3. 弱结构数组用 JSONB
        for table, column in (
            ("task", "labels"),
            ("project", "milestones"),
            ("comment", "reactions"),
            ("saved_view", "filters"),
            ("preference", "data"),
        ):
            assert isinstance(column_type(table, column), JSONB)

        # 4. 排序用 Float8（DOUBLE PRECISION）分数插值
        for table, column in (
            ("task", "order"),
            ("project", "order"),
            ("task_subtask_link", "order"),
        ):
            assert str(column_type(table, column)).upper().startswith("DOUBLE")

        # 5. notif 去重约束
        notif_unique = inspector.get_unique_constraints("notif")
        assert any(
            set(constraint["column_names"]) == {"type", "task_id", "member_id"}
            for constraint in notif_unique
        )

        # 6. users.owner_member_id ↔ Owner 成员
        owner_fk = [
            fk
            for fk in inspector.get_foreign_keys("user")
            if fk["constrained_columns"] == ["owner_member_id"]
        ]
        assert owner_fk and owner_fk[0]["referred_table"] == "member"
        assert any(
            constraint["column_names"] == ["owner_member_id"]
            for constraint in inspector.get_unique_constraints("user")
        )

        # 7. 工作区名称 / URL 不新增表（preference.data 的 workspace 键承载）
        assert "workspace" not in names

        # 关系抽样：任务归属项目、指派成员；评论归属任务；子任务清单唯一挂父任务
        task_fks = {
            tuple(fk["constrained_columns"]): fk["referred_table"]
            for fk in inspector.get_foreign_keys("task")
        }
        assert task_fks[("project_id",)] == "project"
        assert task_fks[("assignee_id",)] == "member"
        comment_fks = {
            tuple(fk["constrained_columns"]): fk["referred_table"]
            for fk in inspector.get_foreign_keys("comment")
        }
        assert comment_fks[("task_id",)] == "task"
        link_fks = {
            tuple(fk["constrained_columns"]): fk["referred_table"]
            for fk in inspector.get_foreign_keys("task_subtask_link")
        }
        assert link_fks[("parent_task_id",)] == "task"
        assert link_fks[("subtask_id",)] == "subtask"
        assert any(
            constraint["column_names"] == ["subtask_id"]
            for constraint in inspector.get_unique_constraints("task_subtask_link")
        )
