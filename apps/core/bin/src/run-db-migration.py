import sys

sys.path.append(".")

from eave.dev_tooling.dotenv_loader import load_standard_dotenv_files

load_standard_dotenv_files()

# ruff: noqa: E402

import logging
import os
import click
import alembic
import alembic.config
import alembic.command
import alembic.script
import alembic.migration
from eave.stdlib.logging import eaveLogger


_alembic_config = alembic.config.Config("alembic.ini")


@click.command()
def upgrade() -> None:
    alembic.command.history(
        config=_alembic_config,
        indicate_current=True,
    )

    eave_db_name = os.environ["EAVE_DB_NAME"]
    eave_db_host = os.environ["EAVE_DB_HOST"]
    google_cloud_project = os.environ["GOOGLE_CLOUD_PROJECT"]

    eaveLogger.fprint(logging.WARNING, "Running DB migrations!")
    eaveLogger.fprint(logging.WARNING, f"GOOGLE_CLOUD_PROJECT={google_cloud_project}")
    eaveLogger.fprint(logging.WARNING, f"EAVE_DB_NAME={eave_db_name}")
    eaveLogger.fprint(logging.WARNING, f"EAVE_DB_HOST={eave_db_host}")

    answer = input(eaveLogger.f(logging.WARNING, "Proceed? (Y/n) "))

    if answer != "Y":
        raise click.Abort()

    alembic.command.upgrade(
        revision="head",
        config=_alembic_config,
    )


if __name__ == "__main__":
    upgrade()
