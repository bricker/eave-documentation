from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Self, Sequence, Tuple
from uuid import UUID

from sqlalchemy import Index, PrimaryKeyConstraint, ForeignKeyConstraint, Select
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

import eave.stdlib.util
from eave.stdlib.core_api.models.github_repos import (
    GithubRepo,
    GithubRepoUpdateValues,
    GithubRepoFeatureState,
    GithubRepoFeature,
)

from .base import Base
from .util import UUID_DEFAULT_EXPR, make_team_fk


class GithubRepoOrm(Base):
    __tablename__ = "github_repos"
    __table_args__ = (
        PrimaryKeyConstraint(
            "team_id",
            "id",
        ),
        make_team_fk(),
        ForeignKeyConstraint(
            ["github_installation_id"],
            ["github_installations.id"],
            ondelete="CASCADE",
            name="github_installation_id_github_installations_fk",
        ),
        Index(
            None,
            "team_id",
            "external_repo_id",
            unique=True,
        ),
    )

    team_id: Mapped[UUID] = mapped_column()
    id: Mapped[UUID] = mapped_column(server_default=UUID_DEFAULT_EXPR)
    github_installation_id: Mapped[UUID] = mapped_column()
    """FK to github_installations.id"""
    external_repo_id: Mapped[str] = mapped_column(unique=True)
    """github API node_id for this repo"""
    display_name: Mapped[Optional[str]] = mapped_column()
    """Human-readable reference, for display only"""
    api_documentation_state: Mapped[str] = mapped_column()
    """Activation status of the API documentation feature for this repo. options: disabled, enabled, paused"""
    inline_code_documentation_state: Mapped[str] = mapped_column()
    """Activation status of the inline code documentation feature for this repo. options: disabled, enabled, paused"""
    architecture_documentation_state: Mapped[str] = mapped_column()
    """Activation status of the architecture documentation feature for this repo. options: disabled, enabled, paused"""
    created: Mapped[datetime] = mapped_column(server_default=func.current_timestamp())
    updated: Mapped[Optional[datetime]] = mapped_column(server_default=None, onupdate=func.current_timestamp())

    @property
    def api_model(self) -> GithubRepo:
        return GithubRepo.from_orm(self)

    @dataclass
    class QueryParams:
        team_id: Optional[UUID]
        id: Optional[UUID] = None
        ids: Optional[list[UUID]] = None
        external_repo_id: Optional[str] = None
        external_repo_ids: Optional[list[str]] = None
        api_documentation_state: Optional[GithubRepoFeatureState] = None
        inline_code_documentation_state: Optional[GithubRepoFeatureState] = None
        architecture_documentation_state: Optional[GithubRepoFeatureState] = None

        def validate_or_exception(self):
            assert eave.stdlib.util.nand(
                self.external_repo_ids is not None, self.external_repo_id is not None
            ), "external_repo_ids and external_repo_id are mutually exclusive inputs"

            assert eave.stdlib.util.nand(
                self.ids is not None, self.id is not None
            ), "ids and id are mutually exclusive inputs"

    @classmethod
    def _build_query(cls, params: QueryParams) -> Select[Tuple[Self]]:
        params.validate_or_exception()
        lookup = select(cls)

        if params.team_id:
            lookup = lookup.where(cls.team_id == params.team_id)

        if params.id:
            lookup = lookup.where(cls.id == params.id)

        if params.ids:
            lookup = lookup.where(cls.id.in_(params.ids))

        if params.external_repo_ids:
            lookup = lookup.where(cls.external_repo_id.in_(params.external_repo_ids))

        if params.external_repo_id:
            lookup = lookup.where(cls.external_repo_id == params.external_repo_id)

        if params.api_documentation_state:
            lookup = lookup.where(cls.api_documentation_state == params.api_documentation_state.value)

        if params.inline_code_documentation_state:
            lookup = lookup.where(cls.inline_code_documentation_state == params.inline_code_documentation_state.value)

        if params.architecture_documentation_state:
            lookup = lookup.where(cls.architecture_documentation_state == params.architecture_documentation_state.value)

        assert lookup.whereclause is not None, "Malformed input"
        return lookup

    @classmethod
    async def create(
        cls,
        session: AsyncSession,
        team_id: UUID,
        external_repo_id: str,
        github_installation_id: UUID,
        display_name: Optional[str],
        api_documentation_state: Optional[GithubRepoFeatureState] = None,
        inline_code_documentation_state: Optional[GithubRepoFeatureState] = None,
        architecture_documentation_state: Optional[GithubRepoFeatureState] = None,
    ) -> Self:
        obj = cls(
            team_id=team_id,
            external_repo_id=external_repo_id,
            github_installation_id=github_installation_id,
            display_name=display_name,
            api_documentation_state=api_documentation_state or GithubRepoFeatureState.ENABLED.value,
            inline_code_documentation_state=inline_code_documentation_state or GithubRepoFeatureState.ENABLED.value,
            architecture_documentation_state=architecture_documentation_state or GithubRepoFeatureState.ENABLED.value,
        )
        session.add(obj)
        await session.flush()
        return obj

    @classmethod
    async def query(
        cls,
        session: AsyncSession,
        params: QueryParams,
    ) -> Sequence[Self]:
        """
        Get/list GithubRepos.
        Optionally provide a list of
        `external_repo_ids` to fetch. Providing None for `external_repo_ids` (or empty list)
        will get all repos for the provided `team_id`.
        """
        stmt = cls._build_query(params=params)
        stmt = stmt.order_by(cls.display_name)

        result = (await session.scalars(stmt)).all()
        return result

    @classmethod
    async def one_or_exception(cls, team_id: UUID, id: UUID, session: AsyncSession) -> Self:
        stmt = cls._build_query(cls.QueryParams(team_id=team_id, id=id)).limit(1)
        result = (await session.scalars(stmt)).one()
        return result

    @classmethod
    async def one_or_none(cls, team_id: UUID, id: UUID, session: AsyncSession) -> Self | None:
        stmt = cls._build_query(cls.QueryParams(team_id=team_id, id=id)).limit(1)
        result = await session.scalar(stmt)
        return result

    def update(self, input: GithubRepoUpdateValues) -> None:
        if input.api_documentation_state is not None:
            self.api_documentation_state = input.api_documentation_state.value
        if input.architecture_documentation_state is not None:
            self.architecture_documentation_state = input.architecture_documentation_state.value
        if input.inline_code_documentation_state is not None:
            self.inline_code_documentation_state = input.inline_code_documentation_state.value

    @classmethod
    async def delete_by_ids(cls, team_id: UUID, ids: list[UUID], session: AsyncSession) -> None:
        if len(ids) < 1:
            # no work to be done (also dont delete ALL entries for team_id)
            return

        stmt = delete(cls).where(cls.team_id == team_id).where(cls.id.in_(ids))
        await session.execute(stmt)

    @classmethod
    async def all_repos_match_feature_state(
        cls, team_id: UUID, feature: GithubRepoFeature, state: GithubRepoFeatureState, session: AsyncSession
    ) -> bool:
        """
        Check if for a given `team_id` all their repos have the specified `state` for a `feature`.

        This query will make use of the composite index for the team_id where clause, which should filter out
        most entries. However, a linear scan will be used for the feature state comparisons. Hopefully it will
        not be too expensive of a query to scan all the repos of a single team.
        """
        stmt = cls._build_query(cls.QueryParams(team_id=team_id))

        # we find all entries for feature status NOT matching the provided one.
        # if there are 0 matches, that means all rows have the same status
        # for `feature` (or there are 0 rows)
        match feature:
            case GithubRepoFeature.INLINE_CODE_DOCUMENTATION:
                stmt = stmt.where(cls.inline_code_documentation_state != state.value)
            case GithubRepoFeature.API_DOCUMENTATION:
                stmt = stmt.where(cls.api_documentation_state != state.value)
            case GithubRepoFeature.ARCHITECTURE_DOCUMENTATION:
                stmt = stmt.where(cls.architecture_documentation_state != state.value)

        result = (await session.scalars(stmt)).all()
        return len(result) == 0
