"""updates

Revision ID: 65f5fa43fee1
Revises: 70b7dad6deff
Create Date: 2023-10-03 15:35:47.026604

"""

# revision identifiers, used by Alembic.
revision = "65f5fa43fee1"
down_revision = "4d537925ec55"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


# def upgrade() -> None:
#     # ### commands auto generated by Alembic - please adjust! ###
#     op.drop_index("ix_github_documents_id", table_name="github_documents")
#     # ### end Alembic commands ###


# def downgrade() -> None:
#     # ### commands auto generated by Alembic - please adjust! ###
#     op.create_index("ix_github_documents_id", "github_documents", ["id"], unique=False)
#     # ### end Alembic commands ###
