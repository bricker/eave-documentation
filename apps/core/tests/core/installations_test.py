from http import HTTPStatus
import eave.core.internal.oauth.slack
import eave.core.internal.orm.atlassian_installation
import eave.core.internal.orm.github_installation
import eave.core.internal.orm.slack_installation
import eave.core.internal.orm.team
from eave.stdlib.core_api.models.atlassian import AtlassianInstallationInput
from eave.stdlib.core_api.models.error import ErrorResponse
from eave.stdlib.core_api.models.github import GithubInstallationInput
from eave.stdlib.core_api.models.slack import SlackInstallationInput
from eave.stdlib.core_api.operations.atlassian import GetAtlassianInstallation
from eave.stdlib.core_api.operations.github import GetGithubInstallation
from eave.stdlib.core_api.operations.slack import GetSlackInstallation

from .base import BaseTestCase


class TestInstallationsRequests(BaseTestCase):
    async def test_get_slack_installation(self) -> None:
        async with self.db_session.begin() as s:
            team = await self.make_team(s)

            await eave.core.internal.orm.slack_installation.SlackInstallationOrm.create(
                session=s,
                team_id=team.id,
                bot_refresh_token=self.anystring("bot_refresh_token"),
                bot_token=self.anystring("bot_token"),
                slack_team_id=self.anystring("slack_team_id"),
                bot_token_exp=self.anydatetime("bot_token_exp", future=True),
            )

        response = await self.make_request(
            path=GetSlackInstallation.config.path,
            payload=GetSlackInstallation.RequestBody(
                slack_integration=SlackInstallationInput(
                    slack_team_id=self.anystring("slack_team_id"),
                )
            ),
        )

        assert response.status_code == HTTPStatus.OK
        response_obj = GetSlackInstallation.ResponseBody(**response.json())

        assert response_obj.slack_integration.slack_team_id == self.anystring("slack_team_id")
        assert response_obj.slack_integration.bot_token == self.anystring("bot_token")

    async def test_get_slack_installation_validation_error(self) -> None:
        async with self.db_session.begin() as s:
            team = await self.make_team(s)

            await eave.core.internal.orm.slack_installation.SlackInstallationOrm.create(
                session=s,
                team_id=team.id,
                bot_refresh_token=self.anystring("bot_refresh_token"),
                bot_token=self.anystring("bot_token"),
                slack_team_id=self.anystring("slack_team_id"),
                bot_token_exp=self.anydatetime("bot_token_exp", future=True),
            )

        response = await self.make_request(
            path=GetSlackInstallation.config.path,
            payload={
                self.anystring(): {
                    self.anystring(): self.anystring(),
                },
            },
        )

        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    async def test_get_slack_installation_not_found(self) -> None:
        response = await self.make_request(
            path=GetSlackInstallation.config.path,
            payload=GetSlackInstallation.RequestBody(
                slack_integration=SlackInstallationInput(
                    slack_team_id=self.anystring("slack_team_id"),
                )
            ),
        )

        response_obj = ErrorResponse(**response.json())
        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response_obj.status_code == HTTPStatus.NOT_FOUND
        assert response_obj.error_message == "Not Found"

    async def test_get_github_installation(self) -> None:
        async with self.db_session.begin() as s:
            team = await self.make_team(s)

            await eave.core.internal.orm.github_installation.GithubInstallationOrm.create(
                session=s,
                team_id=team.id,
                github_install_id=self.anystring("github_install_id"),
            )

        response = await self.make_request(
            path=GetGithubInstallation.config.path,
            payload=GetGithubInstallation.RequestBody(
                github_integration=GithubInstallationInput(
                    github_install_id=self.anystring("github_install_id"),
                ),
            ),
        )

        assert response.status_code == HTTPStatus.OK
        response_obj = GetGithubInstallation.ResponseBody(**response.json())

        assert response_obj.github_integration.github_install_id == self.anystring("github_install_id")

    async def test_get_github_installation_not_found(self) -> None:
        response = await self.make_request(
            path=GetGithubInstallation.config.path,
            payload=GetGithubInstallation.RequestBody(
                github_integration=GithubInstallationInput(
                    github_install_id=self.anystring("github_install_id"),
                ),
            ),
        )

        response_obj = ErrorResponse(**response.json())
        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response_obj.status_code == HTTPStatus.NOT_FOUND
        assert response_obj.error_message == "Not Found"

    async def test_get_atlassian_installation(self) -> None:
        async with self.db_session.begin() as s:
            team = await self.make_team(s)

            await eave.core.internal.orm.atlassian_installation.AtlassianInstallationOrm.create(
                session=s,
                team_id=team.id,
                atlassian_cloud_id=self.anystring("atlassian_cloud_id"),
                oauth_token_encoded=self.anyjson("oauth_token_encoded"),
            )

        response = await self.make_request(
            path=GetAtlassianInstallation.config.path,
            payload=GetAtlassianInstallation.RequestBody(
                atlassian_integration=AtlassianInstallationInput(
                    atlassian_cloud_id=self.anystring("atlassian_cloud_id"),
                ),
            ),
        )

        assert response.status_code == HTTPStatus.OK
        response_obj = GetAtlassianInstallation.ResponseBody(**response.json())

        assert response_obj.atlassian_integration.atlassian_cloud_id == self.anystring("atlassian_cloud_id")

    async def test_get_atlassian_installation_not_found(self) -> None:
        response = await self.make_request(
            path=GetAtlassianInstallation.config.path,
            payload=GetAtlassianInstallation.RequestBody(
                atlassian_integration=AtlassianInstallationInput(
                    atlassian_cloud_id=self.anystring("atlassian_cloud_id"),
                ),
            ),
        )

        response_obj = ErrorResponse(**response.json())
        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response_obj.status_code == HTTPStatus.NOT_FOUND
        assert response_obj.error_message == "Not Found"
