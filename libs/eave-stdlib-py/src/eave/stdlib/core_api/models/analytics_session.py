import enum

from eave.stdlib.core_api.models import BaseInputModel, BaseResponseModel
import uuid
from typing import Any, Mapping, Optional


class AnalyticsSession(BaseResponseModel):
    id: uuid.UUID
    visitor_id: Optional[uuid.UUID]
    account_id: Optional[uuid.UUID]

class AnalyticsSessionInput(BaseInputModel):
    visitor_id: Optional[uuid.UUID]
    account_id: Optional[uuid.UUID]
