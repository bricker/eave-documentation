"""remove feature state defaults

Revision ID: 73b3c36dfe6f
Revises: e04a9002c582
Create Date: 2023-10-25 01:07:33.537448

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "73b3c36dfe6f"
down_revision = "e04a9002c582"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("github_repos", "api_documentation_state", server_default=None)
    op.alter_column("github_repos", "inline_code_documentation_state", server_default=None)
    op.alter_column("github_repos", "architecture_documentation_state", server_default=None)
    op.alter_column("github_documents", "status", server_default=None)
