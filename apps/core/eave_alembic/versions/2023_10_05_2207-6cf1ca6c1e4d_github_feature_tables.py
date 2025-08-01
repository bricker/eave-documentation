"""github feature tables

Revision ID: 6cf1ca6c1e4d
Revises: 65f5fa43fee1
Create Date: 2023-10-05 22:07:10.496371

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "6cf1ca6c1e4d"
down_revision = "65f5fa43fee1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "github_repos",
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("(gen_random_uuid())"),
            nullable=False,
        ),
        sa.Column("external_repo_id", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=True),
        sa.Column(
            "api_documentation_state",
            sa.String(),
            server_default="disabled",
            nullable=False,
        ),
        sa.Column(
            "inline_code_documentation_state",
            sa.String(),
            server_default="disabled",
            nullable=False,
        ),
        sa.Column(
            "architecture_documentation_state",
            sa.String(),
            server_default="disabled",
            nullable=False,
        ),
        sa.Column(
            "created",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("updated", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("team_id", "id"),
        sa.UniqueConstraint("external_repo_id"),
    )
    op.create_index(
        op.f("ix_github_repos_team_id"),
        "github_repos",
        ["team_id", "external_repo_id"],
        unique=True,
    )
    op.create_table(
        "github_documents",
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("github_repo_id", sa.Uuid(), nullable=False),
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("(gen_random_uuid())"),
            nullable=False,
        ),
        sa.Column("pull_request_number", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), server_default="processing", nullable=False),
        sa.Column(
            "status_updated",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("file_path", sa.String(), nullable=True),
        sa.Column("api_name", sa.String(), nullable=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column(
            "created",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("updated", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["team_id", "github_repo_id"],
            ["github_repos.team_id", "github_repos.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("team_id", "id"),
    )
    op.create_index(
        op.f("ix_github_documents_team_id"),
        "github_documents",
        ["team_id", "github_repo_id", "pull_request_number"],
        unique=False,
    )
    # op.drop_index(
    #     "ix_forge_installations_forge_app_installation_id",
    #     table_name="forge_installations",
    # )
    # op.drop_table("forge_installations")
    op.add_column(
        "accounts",
        sa.Column(
            "last_login",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
    )
    op.drop_index(
        "ix_github_installations_github_install_id",
        table_name="github_installations",
    )
    op.create_unique_constraint(None, "github_installations", ["github_install_id"])
    # ### end Alembic commands ###
