"""Add creation intents without modifying historical business rows."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a20261117"
down_revision = "53e615ae0aa6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "project_creation_intent",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("nonce", sa.Uuid(), nullable=False),
        sa.Column("request", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("resolved", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("original_project_id", sa.Uuid(), nullable=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("project.id", ondelete="SET NULL"), nullable=True),
        sa.Column("failure_detail", sa.Text(), nullable=True),
        sa.Column("automatic_order_attempted", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "nonce"),
        sa.CheckConstraint("state IN ('processing', 'succeeded', 'failed')"),
        sa.CheckConstraint("(state = 'succeeded') = (original_project_id IS NOT NULL)"),
        sa.CheckConstraint("project_id IS NULL OR state = 'succeeded'"),
    )
    op.create_index("ix_project_creation_intent_project_id", "project_creation_intent", ["project_id"])


def downgrade():
    op.get_bind().execute(sa.text("LOCK TABLE project_creation_intent IN ACCESS EXCLUSIVE MODE"))
    if op.get_bind().execute(sa.text("SELECT EXISTS (SELECT 1 FROM project_creation_intent)")).scalar():
        raise RuntimeError("创建意图非空，禁止降级删除持久映射；请保留扩展表并参阅备份回退说明")
    op.drop_table("project_creation_intent")
