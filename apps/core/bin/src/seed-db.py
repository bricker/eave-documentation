import sys
from eave.core.internal.orm.api_documentation_jobs import ApiDocumentationJobOrm
from eave.core.internal.orm.atlassian_installation import AtlassianInstallationOrm
from eave.core.internal.orm.client_credentials import ClientCredentialsOrm, ClientScope
from eave.core.internal.orm.connect_installation import ConnectInstallationOrm
from eave.core.internal.orm.github_documents import GithubDocumentsOrm
from eave.core.internal.orm.github_installation import GithubInstallationOrm
from eave.core.internal.orm.github_repos import GithubRepoOrm
from eave.core.internal.orm.slack_installation import SlackInstallationOrm
from eave.core.internal.orm.team import TeamOrm

from eave.stdlib.core_api.models.api_documentation_jobs import ApiDocumentationJobState, LastJobResult
from eave.stdlib.core_api.models.github_repos import GithubRepoFeatureState

sys.path.append(".")

from eave.dev_tooling.dotenv_loader import load_standard_dotenv_files

load_standard_dotenv_files()

# ruff: noqa: E402

import asyncio
import logging
import os
import time
import socket

from sqlalchemy.ext.asyncio import AsyncSession

import eave.core.internal
import eave.core.internal.orm.base
from eave.stdlib.core_api.models.connect import AtlassianProduct
from eave.stdlib.core_api.models.github_documents import GithubDocumentType
from eave.stdlib.core_api.models.team import DocumentPlatform
from eave.stdlib.logging import eaveLogger

"""
This script is for seeding your local database with a bunch of garbage
data to help test SQL query performance.

None of the created table rows are valid data, other than the
foreign keys linking correctly.

UNDER NO CIRCUMSTANCES SHOULD THIS BE EVER RUN AGAINST PROD
"""

_EAVE_DB_NAME = os.getenv("EAVE_DB_NAME")
_GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
_GCLOUD_PROJECT = os.getenv("GCLOUD_PROJECT")
_GAE_ENV = os.getenv("GAE_ENV")

eaveLogger.fprint(logging.INFO, f"> GOOGLE_CLOUD_PROJECT: {_GOOGLE_CLOUD_PROJECT}")
eaveLogger.fprint(logging.INFO, f"> EAVE_DB_NAME: {_EAVE_DB_NAME}")

# Some attempts to prevent this script from running against the production database
assert _GAE_ENV is None
assert _GOOGLE_CLOUD_PROJECT != "eave-production"
assert _GCLOUD_PROJECT != "eave-production"
assert _EAVE_DB_NAME is not None
assert _EAVE_DB_NAME != "eave"


async def seed_database() -> None:
    eaveLogger.fprint(logging.INFO, f"> Postgres connection URI: {eave.core.internal.database.async_engine.url}")
    eaveLogger.fprint(logging.WARNING, f"\nThis script will insert junk seed data into the {_EAVE_DB_NAME} database.")

    answer = input(
        eaveLogger.f(logging.WARNING, f"Proceed to insert junk seed data into the {_EAVE_DB_NAME} database? (Y/n) ")
    )
    if answer != "Y":
        print("Aborting.")
        return

    print(f"Starting to seed your db {_EAVE_DB_NAME}...")
    session = AsyncSession(eave.core.internal.database.async_engine)

    num_rows = 100

    # setup progress bar
    curr_progress = f"[0/{num_rows}] :: Seconds remaining: ???"
    sys.stdout.write(curr_progress)
    sys.stdout.flush()

    for row in range(num_rows):
        start = time.perf_counter()
        team = TeamOrm(
            name=f"{socket.gethostname()}{row}",
            document_platform=DocumentPlatform.confluence,
        )
        session.add(team)
        await session.commit()
        await session.refresh(team)  # necessary to populate team.id
        team_id = team.id

        await ClientCredentialsOrm.create(
            session=session,
            team_id=team_id,
            scope=ClientScope.readwrite,
            description=f"credentials for team {team_id} (database seed)",
        )

        # NOTE: not seeding any Subscription objects rn

        slack = SlackInstallationOrm(
            team_id=team_id,
            slack_team_id=f"slack_team_id{row}",
            bot_token="bot_token",
            bot_refresh_token="bot_refresh_token",
            bot_token_exp=None,
        )
        session.add(slack)

        github = GithubInstallationOrm(
            team_id=team_id,
            github_install_id=f"github_install_id{row}",
        )
        session.add(github)
        await session.commit()
        await session.refresh(github)  # necessary to populate fk relation for gh_repo

        atlassian = AtlassianInstallationOrm(
            team_id=team_id,
            atlassian_cloud_id=f"atlassian_cloud_id{row}",
            oauth_token_encoded="oauth_token_encoded",
        )
        session.add(atlassian)

        connect_jira = ConnectInstallationOrm(
            team_id=team_id,
            product=AtlassianProduct.jira,
            client_key=f"client_key{row}",
            shared_secret="shared_secret",
            base_url="base_url",
            org_url=f"org_url{row}",
            atlassian_actor_account_id="atlassian_actor_account_id",
            display_url=None,
            description=None,
        )
        session.add(connect_jira)

        connect_confluence = ConnectInstallationOrm(
            team_id=team_id,
            product=AtlassianProduct.confluence,
            client_key=f"client_key{row}",
            shared_secret="shared_secret",
            base_url="base_url",
            org_url=f"org_url{row}",
            atlassian_actor_account_id="atlassian_actor_account_id",
            display_url=None,
            description=None,
        )
        session.add(connect_confluence)

        gh_repo = await GithubRepoOrm.create(
            session=session,
            team_id=team_id,
            github_installation_id=github.id,
            external_repo_id=f"external_repo_id{row}",
            display_name=f"repository {row}",
            api_documentation_state=GithubRepoFeatureState.ENABLED,
            inline_code_documentation_state=GithubRepoFeatureState.ENABLED,
            architecture_documentation_state=GithubRepoFeatureState.ENABLED,
        )
        await session.commit()
        await session.refresh(gh_repo)  # necessary to populate fk relation for gh_document

        gh_document = GithubDocumentsOrm(
            team_id=team_id,
            github_repo_id=gh_repo.id,
            type=GithubDocumentType.API_DOCUMENT,
            status="processing",
        )
        session.add(gh_document)

        status_job = ApiDocumentationJobOrm(
            team_id=team_id,
            github_repo_id=gh_repo.id,
            state=ApiDocumentationJobState.idle,
            last_result=LastJobResult.none,
        )
        session.add(status_job)

        await session.commit()
        end = time.perf_counter()
        elapsed = end - start

        # update the progress tracker
        sys.stdout.write("\r")  # return to start of line
        sys.stdout.write(" " * len(curr_progress))  # clear old chars from buffer
        sys.stdout.write("\r")  # re-return to start of line
        curr_progress = f"[{row+1}/{num_rows}] :: Seconds remaining: ~{elapsed * (num_rows - row):.1f}"
        sys.stdout.write(curr_progress)
        sys.stdout.flush()

    await session.close()
    await eave.core.internal.database.async_engine.dispose()
    print("\nYour database has been seeded!")


if __name__ == "__main__":
    asyncio.run(seed_database())
