import sys

sys.path.append(".")

from eave.dev_tooling.dotenv_loader import load_standard_dotenv_files

load_standard_dotenv_files()

# ruff: noqa: E402

import asyncio
import logging
import os

import sqlalchemy
from sqlalchemy.ext.asyncio import create_async_engine
import alembic
import alembic.config
import alembic.command

import eave.core.internal
import eave.core.internal.orm
import eave.core.internal.orm.base

from eave.stdlib.logging import eaveLogger


_alembic_config = alembic.config.Config("alembic.ini")

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


async def init_database() -> None:
    """
    https://alembic.sqlalchemy.org/en/latest/cookbook.html#building-an-up-to-date-database-from-scratch
    """
    # We can't connect to the database being created because, well, it doesn't exist.
    # Instead, connect to the postgres database on the host.
    postgres_uri = eave.core.internal.database.async_engine.url._replace(database="postgres")
    postgres_engine = create_async_engine(postgres_uri, isolation_level="AUTOCOMMIT")
    eaveLogger.fprint(logging.INFO, f"> Postgres connection URI: {eave.core.internal.database.async_engine.url}")

    eaveLogger.fprint(
        logging.WARNING, f"\nThis script will perform the following operations on the {_EAVE_DB_NAME} database:"
    )
    eaveLogger.fprint(logging.WARNING, "- 💥 DELETES THE DATABASE 💥 (if it exists)")
    eaveLogger.fprint(logging.WARNING, "- (RE-)CREATES THE DATABASE")

    answer = input(
        eaveLogger.f(logging.WARNING, f"Proceed to delete and (re-)create the {_EAVE_DB_NAME} database? (Y/n) ")
    )
    if answer != "Y":
        print("Aborting.")
        return

    answer = input(eaveLogger.f(logging.WARNING, "Really? (Y/n) "))
    if answer != "Y":
        print("Aborting.")
        return

    async with postgres_engine.begin() as connection:
        stmt = f'DROP DATABASE IF EXISTS "{_EAVE_DB_NAME}"'
        await connection.execute(sqlalchemy.text(stmt))
        stmt = f'CREATE DATABASE "{_EAVE_DB_NAME}"'
        await connection.execute(sqlalchemy.text(stmt))

    # create tables in empty db
    async with eave.core.internal.database.async_engine.begin() as connection:
        await connection.run_sync(eave.core.internal.orm.base.get_base_metadata().create_all)

    alembic.command.stamp(
        revision="head",
        config=_alembic_config,
    )

    await postgres_engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_database())
