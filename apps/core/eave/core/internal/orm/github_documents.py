from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Self, Sequence, Tuple
from uuid import UUID

from sqlalchemy import Index, PrimaryKeyConstraint, Select
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from eave.stdlib.core_api.models.github_documents import (
    GithubDocument,
    GithubDocumentValuesInput,
    GithubDocumentStatus,
    GithubDocumentType,
)
from eave.stdlib.util import ensure_uuid

from .base import Base
from .util import UUID_DEFAULT_EXPR, make_team_composite_fk, make_team_fk


class GithubDocumentsOrm(Base):
    __tablename__ = "github_documents"
    __table_args__ = (
        PrimaryKeyConstraint(
            "team_id",
            "id",
        ),
        make_team_fk(),
        make_team_composite_fk(fk_column="github_repo_id", foreign_table="github_repos"),
        Index(None, "team_id", "github_repo_id", "pull_request_number"),
    )

    team_id: Mapped[UUID] = mapped_column()
    github_repo_id: Mapped[UUID] = mapped_column()
    """FK to github_repos table"""
    id: Mapped[UUID] = mapped_column(server_default=UUID_DEFAULT_EXPR)
    pull_request_number: Mapped[Optional[int]] = mapped_column(server_default=None)
    """Number of the most recent PR opened for this document"""
    status: Mapped[str] = mapped_column()
    """Current state of API documentation for this repo. options: processing, under-review, up-to-date"""
    status_updated: Mapped[datetime] = mapped_column(server_default=func.current_timestamp())
    """Last time the `status` column was updated."""
    file_path: Mapped[Optional[str]] = mapped_column()
    """Relative file path to this document in the given repo."""
    api_name: Mapped[Optional[str]] = mapped_column()
    """Name of the API this document is documenting"""
    type: Mapped[str] = mapped_column()
    """Document type. options: api_document, architecture_document"""
    created: Mapped[datetime] = mapped_column(server_default=func.current_timestamp())
    updated: Mapped[Optional[datetime]] = mapped_column(server_default=None, onupdate=func.current_timestamp())

    @property
    def api_model(self) -> GithubDocument:
        return GithubDocument.from_orm(self)

    @dataclass
    class QueryParams:
        id: Optional[UUID | str] = None
        team_id: Optional[UUID | str] = None
        github_repo_id: Optional[UUID] = None
        type: Optional[GithubDocumentType] = None
        pull_request_number: Optional[int] = None

    @classmethod
    def _build_query(cls, params: QueryParams) -> Select[Tuple[Self]]:
        lookup = select(cls)

        if params.team_id:
            lookup = lookup.where(cls.team_id == ensure_uuid(params.team_id))

        if params.github_repo_id:
            lookup = lookup.where(cls.github_repo_id == params.github_repo_id)

        if params.id:
            lookup = lookup.where(cls.id == ensure_uuid(params.id))

        if params.type:
            lookup = lookup.where(cls.type == params.type.value)

        if params.pull_request_number:
            lookup = lookup.where(cls.pull_request_number == params.pull_request_number)

        return lookup

    @classmethod
    async def query(cls, session: AsyncSession, params: QueryParams) -> Sequence[Self]:
        stmt = cls._build_query(params=params)
        results = (await session.scalars(stmt)).all()
        return results

    @classmethod
    async def one_or_exception(cls, team_id: UUID, id: UUID, session: AsyncSession) -> Self:
        stmt = cls._build_query(cls.QueryParams(team_id=team_id, id=id))
        result = (await session.scalars(stmt)).one()
        return result

    @classmethod
    async def create(
        cls,
        session: AsyncSession,
        team_id: UUID,
        github_repo_id: UUID,
        type: GithubDocumentType,
        file_path: Optional[str] = None,
        api_name: Optional[str] = None,
        pull_request_number: Optional[int] = None,
        status: Optional[GithubDocumentStatus] = None,
        status_updated: Optional[datetime] = None,
    ) -> Self:
        obj = cls(
            team_id=team_id,
            github_repo_id=github_repo_id,
            file_path=file_path,
            api_name=api_name,
            type=type.value,
            pull_request_number=pull_request_number,
            status=status or GithubDocumentStatus.PROCESSING.value,
            status_updated=status_updated,
        )
        session.add(obj)
        await session.flush()
        return obj

    def update(self, values: GithubDocumentValuesInput) -> None:
        if pull_request_number := values.pull_request_number:
            self.pull_request_number = pull_request_number
        if status := values.status:
            self.status = status
            self.status_updated = datetime.now()
        if file_path := values.file_path:
            self.file_path = file_path
        if api_name := values.api_name:
            self.api_name = api_name

    @classmethod
    async def delete_by_ids(cls, team_id: UUID, ids: list[UUID], session: AsyncSession) -> None:
        if len(ids) < 1:
            # don't delete all the rows
            return

        stmt = delete(cls).where(cls.team_id == team_id).where(cls.id.in_(ids))
        await session.execute(stmt)

    @classmethod
    async def delete_by_type(cls, team_id: UUID, type: GithubDocumentType, session: AsyncSession) -> None:
        stmt = delete(cls).where(cls.team_id == team_id).where(cls.type == type)
        await session.execute(stmt)
