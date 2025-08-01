"""add github installations

Revision ID: 271e6339d054
Revises: 7077e9067e19
Create Date: 2023-05-05 19:59:41.043731

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "271e6339d054"
down_revision = "7077e9067e19"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "github_installations",
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("(gen_random_uuid())"),
            nullable=False,
        ),
        sa.Column("github_install_id", sa.String(), nullable=False),
        sa.Column(
            "created",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("updated", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["teams.id"],
        ),
        sa.PrimaryKeyConstraint("team_id", "id"),
    )
    op.create_index(
        "eave_team_id_github_install_id",
        "github_installations",
        ["team_id", "github_install_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_github_installations_github_install_id"),
        "github_installations",
        ["github_install_id"],
        unique=True,
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(
        op.f("ix_github_installations_github_install_id"),
        table_name="github_installations",
    )
    op.drop_index("eave_team_id_github_install_id", table_name="github_installations")
    op.drop_table("github_installations")
    # ### end Alembic commands ###
