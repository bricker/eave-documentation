from http import HTTPStatus
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from eave.core.internal.orm import github_installation

from eave.core.internal.orm.github_documents import GithubDocumentsOrm
from eave.core.internal.orm.github_repos import GithubRepoOrm
from eave.stdlib.core_api.models.github_documents import GithubDocumentType, GithubDocumentStatus
from eave.stdlib.core_api.operations.github_documents import (
    CreateGithubDocumentRequest,
    GetGithubDocumentsRequest,
    UpdateGithubDocumentRequest,
)

from .base import BaseTestCase


class TestGithubDocumentsRequests(BaseTestCase):
    async def create_repo(self, session: AsyncSession, team_id: UUID, index: int = 0) -> GithubRepoOrm:
        gh_install = await github_installation.GithubInstallationOrm.create(
            session=session,
            team_id=team_id,
            github_install_id=self.anystr(),
        )

        return await GithubRepoOrm.create(
            session=session,
            team_id=team_id,
            external_repo_id=self.anystr(f"external_repo_id:{team_id}:{index}"),
            display_name=self.anystr(),
            github_installation_id=gh_install.id,
        )

    async def create_documents(
        self, session: AsyncSession, team_id: UUID, quantity: int = 5
    ) -> list[GithubDocumentsOrm]:
        orms: list[GithubDocumentsOrm] = []
        for i in range(quantity):
            repo = await self.create_repo(
                session=session,
                team_id=team_id,
                index=i,
            )
            doc = await GithubDocumentsOrm.create(
                session=session,
                team_id=team_id,
                github_repo_id=repo.id,
                api_name="eave-the-best",
                file_path="/",
                type=GithubDocumentType.API_DOCUMENT,
            )
            orms.append(doc)
        return orms

    async def test_github_documents_req_get_one_by_repo_id(self) -> None:
        async with self.db_session.begin() as s:
            team = await self.make_team(s)
            orms = await self.create_documents(session=s, team_id=team.id)
            account = await self.make_account(s, team_id=team.id)

        response = await self.make_request(
            path="/github-documents/query",
            payload={
                "query_params": {
                    "external_repo_id": self.getstr(f"external_repo_id:{team.id}:3"),
                    "type": None,
                }
            },
            team_id=team.id,
            account_id=account.id,
            access_token=account.access_token,
        )

        assert response.status_code == HTTPStatus.OK
        response_obj = GetGithubDocumentsRequest.ResponseBody(**response.json())
        assert len(response_obj.documents) == 1
        assert response_obj.documents[0].github_repo_id == orms[0].id
        assert response_obj.documents[0].team_id == team.id
        assert response_obj.documents[0].type == GithubDocumentType.API_DOCUMENT

    async def test_github_documents_req_get_one_by_type(self) -> None:
        async with self.db_session.begin() as s:
            team = await self.make_team(s)
            orms = await self.create_documents(session=s, team_id=team.id)
            orms[3].type = GithubDocumentType.ARCHITECTURE_DOCUMENT
            account = await self.make_account(s, team_id=team.id)

        response = await self.make_request(
            path="/github-documents/query",
            payload={
                "query_params": {
                    "external_repo_id": None,
                    "type": GithubDocumentType.ARCHITECTURE_DOCUMENT,
                }
            },
            team_id=team.id,
            account_id=account.id,
            access_token=account.access_token,
        )

        assert response.status_code == HTTPStatus.OK
        response_obj = GetGithubDocumentsRequest.ResponseBody(**response.json())
        assert len(response_obj.documents) == 1
        assert response_obj.documents[0].github_repo_id == orms[0].id
        assert response_obj.documents[0].team_id == team.id
        assert response_obj.documents[0].type == GithubDocumentType.ARCHITECTURE_DOCUMENT

    async def test_github_documents_req_get_many(self) -> None:
        async with self.db_session.begin() as s:
            team = await self.make_team(s)
            team2 = await self.make_team(s)
            await self.create_documents(session=s, team_id=team.id)
            await self.create_documents(session=s, team_id=team2.id)
            account = await self.make_account(s, team_id=team.id)

        response = await self.make_request(
            path="/github-documents/query",
            payload={
                "query_params": {
                    "external_repo_id": None,
                    "type": GithubDocumentType.API_DOCUMENT,
                }
            },
            team_id=team.id,
            account_id=account.id,
            access_token=account.access_token,
        )

        assert response.status_code == HTTPStatus.OK
        response_obj = GetGithubDocumentsRequest.ResponseBody(**response.json())
        assert len(response_obj.documents) == 5
        assert all(
            map(lambda doc: doc.team_id == team.id, response_obj.documents)
        ), "not all documents had matching team_id"
        assert all(
            map(lambda doc: doc.type == GithubDocumentType.API_DOCUMENT, response_obj.documents)
        ), "not all documents had matching type"

    async def test_github_documents_req_update(self) -> None:
        async with self.db_session.begin() as s:
            team = await self.make_team(s)
            docs = await self.create_documents(session=s, team_id=team.id)
            account = await self.make_account(s, team_id=team.id)

        response = await self.make_request(
            path="/github-documents/update",
            payload={
                "document": {
                    "id": str(docs[3].id),
                    "new_values": {
                        "pull_request_number": 34,
                        "status": GithubDocumentStatus.PR_MERGED,
                        "file_path": "new/location",
                        "api_name": "jimmy-johns-freaky-fast-api",
                    },
                }
            },
            team_id=team.id,
            account_id=account.id,
            access_token=account.access_token,
        )

        assert response.status_code == HTTPStatus.OK
        response_obj = UpdateGithubDocumentRequest.ResponseBody(**response.json())
        assert response_obj.document.id == docs[3].id
        assert response_obj.document.github_repo_id == docs[3].id
        assert response_obj.document.team_id == team.id
        assert response_obj.document.pull_request_number == 34
        assert response_obj.document.status == GithubDocumentStatus.PR_MERGED
        assert response_obj.document.file_path == "new/location"
        assert response_obj.document.api_name == "jimmy-johns-freaky-fast-api"

    async def test_github_documents_req_create(self) -> None:
        async with self.db_session.begin() as s:
            team = await self.make_team(s)
            repo = await self.create_repo(session=s, team_id=team.id)
            account = await self.make_account(s, team_id=team.id)

        response = await self.make_request(
            path="/github-documents/create",
            payload={
                "document": {
                    "external_repo_id": repo.external_repo_id,
                    "pull_request_number": None,
                    "type": GithubDocumentType.ARCHITECTURE_DOCUMENT,
                    "file_path": "first/location",
                    "api_name": "jimmy-johns-freaky-first-api",
                }
            },
            team_id=team.id,
            account_id=account.id,
            access_token=account.access_token,
        )

        assert response.status_code == HTTPStatus.OK
        response_obj = CreateGithubDocumentRequest.ResponseBody(**response.json())
        assert response_obj.document.team_id == team.id
        assert response_obj.document.github_repo_id == repo.id
        assert response_obj.document.pull_request_number is None
        assert response_obj.document.type == GithubDocumentType.ARCHITECTURE_DOCUMENT
        assert response_obj.document.file_path == "first/location"
        assert response_obj.document.api_name == "jimmy-johns-freaky-first-api"

    async def test_github_documents_req_delete_by_ids(self) -> None:
        async with self.db_session.begin() as s:
            team = await self.make_team(s)
            orms = await self.create_documents(session=s, team_id=team.id)
            account = await self.make_account(s, team_id=team.id)

        # delete some rows from table and make sure request is successful

        response = await self.make_request(
            path="/github-documents/delete/id",
            payload={"documents": [{"id": str(orms[i].id)} for i in range(2)]},
            team_id=team.id,
            account_id=account.id,
            access_token=account.access_token,
        )

        assert response.status_code == HTTPStatus.OK

        # verify that correct number of rows were deleted from the table

        response = await self.make_request(
            path="/github-documents/query",
            payload={"query_params": {}},
            team_id=team.id,
            account_id=account.id,
            access_token=account.access_token,
        )

        assert response.status_code == HTTPStatus.OK
        response_obj = GetGithubDocumentsRequest.ResponseBody(**response.json())
        assert len(response_obj.documents) == 3

    async def test_github_documents_req_delete_by_type(self) -> None:
        async with self.db_session.begin() as s:
            team = await self.make_team(s)
            orms = await self.create_documents(session=s, team_id=team.id)
            # change 1 document type to be expected to remain after delete op
            orms[2].type = GithubDocumentType.ARCHITECTURE_DOCUMENT
            account = await self.make_account(s, team_id=team.id)

        # delete some rows from table and make sure request is successful

        response = await self.make_request(
            path="/github-documents/delete/type",
            payload={"documents": {"type": GithubDocumentType.API_DOCUMENT}},
            team_id=team.id,
            account_id=account.id,
            access_token=account.access_token,
        )

        assert response.status_code == HTTPStatus.OK

        # verify that correct number of rows were deleted from the table

        response = await self.make_request(
            path="/github-documents/query",
            payload={"query_params": {}},
            team_id=team.id,
            account_id=account.id,
            access_token=account.access_token,
        )

        assert response.status_code == HTTPStatus.OK
        response_obj = GetGithubDocumentsRequest.ResponseBody(**response.json())
        assert len(response_obj.documents) == 1
