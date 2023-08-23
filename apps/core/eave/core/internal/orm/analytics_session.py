import typing
import uuid
from datetime import datetime
from typing import Any, NotRequired, Optional, Required, Self, Tuple, TypedDict, Unpack
from uuid import UUID
from eave.core.internal.orm.account import AccountOrm

from sqlalchemy import ForeignKeyConstraint, Index, Select, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column
from eave.core.internal.orm.util import UUID_DEFAULT_EXPR
from eave.stdlib.core_api.models.analytics_session import AnalyticsSession

from eave.stdlib.util import ensure_uuid_or_none

from .base import Base


class AnalyticsSessionOrm(Base):
    __tablename__ = "analytics_sessions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
        )
    )

    # other possible properties:
    # - device
    #
    id: Mapped[UUID] = mapped_column(server_default=UUID_DEFAULT_EXPR)
    visitor_id: Mapped[Optional[UUID]] = mapped_column()
    account_id: Mapped[Optional[UUID]] = mapped_column()
    created: Mapped[datetime] = mapped_column(server_default=func.current_timestamp())
    updated: Mapped[Optional[datetime]] = mapped_column(server_default=None, onupdate=func.current_timestamp())

    @classmethod
    async def create(
        cls,
        session: AsyncSession,
        visitor_id: Optional[UUID | str],
        account_id: Optional[UUID | str],
    ) -> Self:
        obj = cls(
            visitor_id=ensure_uuid_or_none(visitor_id),
            account_id=ensure_uuid_or_none(account_id),
        )

        session.add(obj)
        await session.flush()
        return obj

    class _selectparams(TypedDict):
        id: Required[uuid.UUID | str]

    @classmethod
    def _build_select(cls, **kwargs: Unpack[_selectparams]) -> Select[Tuple[Self]]:
        lookup = select(cls).limit(1)

        if id := kwargs.get("id"):
            lookup = lookup.where(cls.id == id)

        assert lookup.whereclause is not None, "Invalid parameters"
        return lookup

    @classmethod
    async def one_or_exception(cls, session: AsyncSession, **kwargs: Unpack[_selectparams]) -> Self:
        lookup = cls._build_select(**kwargs)
        result = (await session.scalars(lookup)).one()
        return result

    @classmethod
    async def one_or_none(cls, session: AsyncSession, **kwargs: Unpack[_selectparams]) -> Self | None:
        lookup = cls._build_select(**kwargs)
        result = await session.scalar(lookup)
        return result

    async def get_account(self, session: AsyncSession) -> AccountOrm | None:
        if self.account_id is None:
            return None

        account = await AccountOrm.one_or_none(session=session, id=self.account_id)
        return account

    @property
    def api_model(self) -> AnalyticsSession:
        return AnalyticsSession.from_orm(self)
