from dataclasses import dataclass
import uuid
from datetime import datetime
from typing import NotRequired, Optional, Self, Tuple, TypedDict, Unpack
from uuid import UUID

from sqlalchemy import Index, Select, func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from eave.stdlib.core_api.models.github import GithubInstallation, GithubInstallationPeek

from .base import Base
from .util import UUID_DEFAULT_EXPR, make_team_fk


class GithubInstallationOrm(Base):
    __tablename__ = "github_installations"
    __table_args__ = (
        make_team_fk(),
        Index(
            "eave_team_id_github_install_id",
            "team_id",
            "github_install_id",
            unique=True,
        ),
    )

    team_id: Mapped[Optional[UUID]] = mapped_column()
    id: Mapped[UUID] = mapped_column(server_default=UUID_DEFAULT_EXPR, unique=True, primary_key=True)
    github_install_id: Mapped[str] = mapped_column(unique=True)
    github_owner_login: Mapped[str] = mapped_column(nullable=True)
    install_flow_state: Mapped[Optional[str]] = mapped_column(nullable=True)
    created: Mapped[datetime] = mapped_column(server_default=func.current_timestamp())
    updated: Mapped[Optional[datetime]] = mapped_column(server_default=None, onupdate=func.current_timestamp())

    @classmethod
    async def create(
        cls,
        session: AsyncSession,
        team_id: Optional[uuid.UUID],
        github_install_id: str,
        github_owner_login: Optional[str] = None,
        install_flow_state: Optional[str] = None,
    ) -> Self:
        obj = cls(
            team_id=team_id,
            github_install_id=github_install_id,
            github_owner_login=github_owner_login,
            install_flow_state=install_flow_state,
        )
        session.add(obj)
        await session.flush()
        return obj

    class UpdateParameters(TypedDict):
        team_id: NotRequired[uuid.UUID]
        install_flow_state: NotRequired[Optional[str]]

    def update(
        self,
        session: AsyncSession,
        **kwargs: Unpack[UpdateParameters],
    ) -> Self:
        """session parameter required (although unused) to indicate this should only be called w/in a db session"""
        if self.team_id is None and (team_id := kwargs.get("team_id")):
            self.team_id = team_id

        # cant use walrus op here since we dont want to filter out passed None values
        if "install_flow_state" in kwargs:
            self.install_flow_state = kwargs.get("install_flow_state")
        return self

    @dataclass
    class QueryParams:
        team_id: Optional[uuid.UUID] = None
        id: Optional[uuid.UUID] = None
        github_install_id: Optional[str] = None

    @classmethod
    def _build_select(cls, params: QueryParams) -> Select[Tuple[Self]]:
        lookup = select(cls)

        if params.team_id:
            lookup = lookup.where(cls.team_id == params.team_id)

        if params.id:
            lookup = lookup.where(cls.id == params.id)

        if params.github_install_id:
            lookup = lookup.where(cls.github_install_id == params.github_install_id)

        assert lookup.whereclause is not None, "Invalid parameters"
        return lookup

    @classmethod
    async def query(cls, session: AsyncSession, params: QueryParams) -> Self | None:
        lookup = cls._build_select(params=params).limit(1)
        result = await session.scalar(lookup)
        return result

    @classmethod
    async def one_or_none(cls, session: AsyncSession, team_id: UUID) -> Self | None:
        lookup = cls._build_select(params=cls.QueryParams(team_id=team_id)).limit(1)
        result = await session.scalar(lookup)
        return result

    @classmethod
    async def one_or_exception(cls, session: AsyncSession, team_id: UUID) -> Self:
        """
        Although the database doesn't enforce 1:1 relationship between github_installations and teams, this function implicitly enforces it by:
        1. only accepting a team_id (not the primary id),
        2. throwing an error there are no results,
        3. Returning only one result
        """
        lookup = cls._build_select(params=cls.QueryParams(team_id=team_id)).limit(1)
        result = (await session.scalars(lookup)).one()
        return result

    @classmethod
    async def delete_by_github_install_id(cls, team_id: UUID, github_install_id: str, session: AsyncSession) -> None:
        stmt = delete(cls).where(cls.team_id == team_id).where(cls.github_install_id == github_install_id)
        await session.execute(stmt)

    @property
    def api_model(self) -> GithubInstallation:
        return GithubInstallation.from_orm(self)

    @property
    def api_model_peek(self) -> GithubInstallationPeek:
        return GithubInstallationPeek.from_orm(self)
