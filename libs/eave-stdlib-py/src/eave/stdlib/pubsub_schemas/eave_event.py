from typing import Optional
from uuid import UUID
from pydantic import BaseModel

from eave.stdlib.config import EaveEnvironment
from eave.stdlib.core_api.models.account import AnalyticsAccount
from eave.stdlib.core_api.models.team import AnalyticsTeam
from eave.stdlib.logging import LogContext
from eave.stdlib.typing import JsonObject

class EaveEvent(BaseModel):
    event_name: str
    event_ts: float
    event_description: Optional[str] = None
    event_source: Optional[str] = None
    eave_account_id: Optional[str] = None
    eave_visitor_id: Optional[str] = None
    eave_team_id: Optional[str] = None
    eave_env: Optional[str] = None
    opaque_params: Optional[JsonObject] = None
    opaque_eave_ctx: Optional[LogContext] = None
    eave_account: Optional[AnalyticsAccount] = None
    eave_team: Optional[AnalyticsTeam] = None
