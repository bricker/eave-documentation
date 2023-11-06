import datetime
from enum import StrEnum
from typing import Optional
import uuid

from eave.stdlib.core_api.models import BaseResponseModel
from eave.stdlib.core_api.models import BaseInputModel


class GithubDocumentStatus(StrEnum):
    PROCESSING = "processing"
    FAILED = "failed"
    PR_OPENED = "pr_opened"
    PR_MERGED = "pr_merged"
    PR_CLOSED = "pr_closed"


class GithubDocumentType(StrEnum):
    API_DOCUMENT = "api_document"
    ARCHITECTURE_DOCUMENT = "architecture_document"


class GithubDocument(BaseResponseModel):
    id: uuid.UUID
    team_id: uuid.UUID
    github_repo_id: uuid.UUID
    pull_request_number: Optional[int]
    status: GithubDocumentStatus
    status_updated: datetime.datetime
    file_path: Optional[str]
    api_name: Optional[str]
    type: GithubDocumentType


class GithubDocumentsQueryInput(BaseInputModel):
    id: Optional[uuid.UUID] = None
    github_repo_id: Optional[uuid.UUID] = None
    type: Optional[GithubDocumentType] = None
    pull_request_number: Optional[int] = None


class GithubDocumentCreateInput(BaseInputModel):
    type: GithubDocumentType
    status: Optional[GithubDocumentStatus] = None
    file_path: Optional[str]
    api_name: Optional[str]
    pull_request_number: Optional[int]


class GithubDocumentValuesInput(BaseInputModel):
    pull_request_number: Optional[int] = None
    status: Optional[GithubDocumentStatus] = None
    file_path: Optional[str] = None
    api_name: Optional[str] = None


class GithubDocumentUpdateInput(BaseInputModel):
    id: uuid.UUID
    new_values: GithubDocumentValuesInput


class GithubDocumentsDeleteByIdsInput(BaseInputModel):
    id: uuid.UUID


class GithubDocumentsDeleteByTypeInput(BaseInputModel):
    type: GithubDocumentType
