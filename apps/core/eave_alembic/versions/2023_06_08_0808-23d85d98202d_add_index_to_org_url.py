"""add index to org url

Revision ID: 23d85d98202d
Revises: a61fd4303d02
Create Date: 2023-06-08 08:08:40.435044

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "23d85d98202d"
down_revision = "a61fd4303d02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_index(
        op.f("ix_connect_installations_org_url"),
        "connect_installations",
        ["org_url"],
        unique=False,
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(
        op.f("ix_connect_installations_org_url"),
        table_name="connect_installations",
    )
    # ### end Alembic commands ###
