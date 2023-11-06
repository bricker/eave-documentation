import sys

sys.path.append(".")

from eave.dev_tooling.dotenv_loader import load_standard_dotenv_files

load_standard_dotenv_files()

# ruff: noqa: E402

import click
import alembic
import alembic.config
import alembic.command

_alembic_config = alembic.config.Config("alembic.ini")


@click.command()
@click.option("-m", "--message", required=True)
def create_revision(message: str) -> None:
    alembic.command.revision(
        config=_alembic_config,
        message=message,
        autogenerate=True,
    )


if __name__ == "__main__":
    create_revision()
