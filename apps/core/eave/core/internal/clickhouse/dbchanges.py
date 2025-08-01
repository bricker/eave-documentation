from datetime import datetime
import json
import re
from textwrap import dedent
from typing import Any, override
from clickhouse_connect.datatypes.base import EMPTY_TYPE_DEF, TypeDef
from clickhouse_connect.datatypes.temporal import DateTime64
from clickhouse_connect.datatypes.numeric import Enum
from clickhouse_connect.datatypes.string import String
from clickhouse_connect.datatypes.container import JSON
from clickhouse_connect.driver.ddl import TableColumnDef

from clickhouse_connect.driver.query import QueryResult
from eave.core.internal import database
from eave.core.internal.clickhouse import clickhouse_client
from eave.core.internal.clickhouse.types import ClickHouseTableDefinition, ClickHouseTableHandle
from eave.core.internal.orm.virtual_event import VirtualEventOrm, make_virtual_event_readable_name
from eave.monitoring.datastructures import DatabaseChangeEventPayload, DatabaseChangeOperation
from eave.stdlib.util import sql_sanitized_identifier, sql_sanitized_literal, tableize, titleize


table_definition = ClickHouseTableDefinition(
    name="dbchanges",
    columns=[
        TableColumnDef(name="table_name", ch_type=String(EMPTY_TYPE_DEF)),
        TableColumnDef(name="operation", ch_type=Enum(TypeDef(values=tuple(DatabaseChangeOperation._member_names_)))),
        TableColumnDef(name="timestamp", ch_type=DateTime64(TypeDef(values=(6, "'UTC'")))),
        TableColumnDef(name="old_data", ch_type=JSON(EMPTY_TYPE_DEF)),
        TableColumnDef(name="new_data", ch_type=JSON(EMPTY_TYPE_DEF)),
    ],
    primary_key_columns=[
        "table_name",
        "operation",
        "timestamp",
    ],
    engine="MergeTree",
)


class DatabaseChangesTableHandle(ClickHouseTableHandle):
    table = table_definition

    async def create_vevent_view(self, *, operation: str, source_table: str) -> None:
        vevent_readable_name = make_virtual_event_readable_name(operation=operation, table_name=source_table)
        vevent_view_name = tableize(vevent_readable_name)

        clickhouse_client.chclient.command(
            dedent(
                """
                CREATE VIEW IF NOT EXISTS {database}.{view_name} AS
                    SELECT
                        *
                    FROM
                        {database}.{table_name}
                    WHERE
                        `table_name` = {source_table}
                        AND `operation` = {operation}
                    ORDER BY
                        `timestamp` ASC
                """.format(
                    database=sql_sanitized_identifier(self.database),
                    view_name=sql_sanitized_identifier(vevent_view_name),
                    table_name=sql_sanitized_identifier(self.table.name),
                    source_table=sql_sanitized_literal(source_table),
                    operation=sql_sanitized_literal(operation),
                )
            ).strip(),
        )

        async with database.async_session.begin() as db_session:
            vevent_query = await VirtualEventOrm.query(session=db_session, params=VirtualEventOrm.QueryParams())

            if not vevent_query.one_or_none():
                await VirtualEventOrm.create(
                    session=db_session,
                    team_id=self.team_id,
                    view_name=vevent_view_name,
                    readable_name=vevent_readable_name,
                    description=f"{operation} operation on the {source_table} table.",
                )

    @override
    async def insert(self, events: list[str]) -> None:
        if len(events) == 0:
            return

        dbchange_events = [DatabaseChangeEventPayload(**json.loads(e)) for e in events]

        await clickhouse_client.create_database(name=self.database)
        await self.create_table()

        # Each Eave team has its own database (effectively a namespace), each with its own tables, eg `dbchanges`.
        # Because the JSON columns (eg new_data) expand arbitrary JSON keys into concrete columns, sharing tables for all customers would result in every row having columns from all customers, a non-starter for both privacy and scalability. Even with columnar database, there is a soft upper limit on number of columns (on the order of 10k).
        # By separating the tables, each team only has columns for their data.
        # Additionally, for the dbchanges table, `new_data` and `old_data` have nested within them the name of the table, eg: `"new_data": { "teams": { "name": "...", ... } }`. This way, the columns from each database table are isolated from others, allowing us to groups the clickhouse columns by table name.
        clickhouse_client.chclient.insert(
            database=self.database,
            table=self.table.name,
            column_names=self.table.column_names,
            column_types=self.table.column_types,
            data=[self._format_row(e) for e in dbchange_events],
            settings={
                "async_insert": 1,
                "wait_for_async_insert": 1,
            },
        )

        unique_operations = set((e.operation, e.table_name) for e in dbchange_events)

        # FIXME: This is vulnerable to a DoS where unique `table_name` is generated and inserted on a loop.
        for operation, table_name in unique_operations:
            await self.create_vevent_view(operation=operation, source_table=table_name)

    @override
    async def query(self, query: str) -> QueryResult:
        results = clickhouse_client.chclient.query(query)
        return results

    def _format_row(self, event: DatabaseChangeEventPayload) -> list[Any]:
        """
        >>> _format_row(event=RawEvent(event_type="dbchange", payload='{"timestamp":"2023-12-22T17:09:22.797036", "table_name":"accounts", "operation":"INSERT", "new_data":"_new", "old_data":"_old"}'))
        {'table_name': 'accounts', 'operation': 'INSERT', 'timestamp': '2023-12-22T17:09:22.797036', 'new_data': {'accounts': '_new'}, 'old_data': {'accounts': '_old'}}
        """
        d = {
            "table_name": event.table_name,
            "operation": event.operation,
            "timestamp": datetime.fromtimestamp(event.timestamp),
            "new_data": {event.table_name: event.new_data},
            "old_data": {event.table_name: event.old_data},
        }

        # This effectively puts the values in the right order.
        return [d[c.name] for c in self.table.columns]
