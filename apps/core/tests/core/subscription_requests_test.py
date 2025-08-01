from http import HTTPStatus

import eave.core.internal.orm.document_reference
from eave.core.internal.orm.subscription import SubscriptionOrm
from eave.stdlib.core_api.models.subscriptions import SubscriptionInput, SubscriptionSource, SubscriptionSourcePlatform
from eave.stdlib.core_api.models.subscriptions import SubscriptionSourceEvent
from eave.stdlib.core_api.operations.subscriptions import DeleteSubscriptionRequest
from eave.stdlib.headers import EAVE_TEAM_ID_HEADER

from .base import BaseTestCase


class TestSubscriptionsEndpoints(BaseTestCase):
    async def asyncSetUp(self) -> None:
        await super().asyncSetUp()
        async with self.db_session.begin() as s:
            self.team = await self.make_team(s)

            document_reference = eave.core.internal.orm.document_reference.DocumentReferenceOrm(
                team_id=self.team.id,
                document_id=self.anystring("confluence_document_response.id"),
                document_url=self.anystring("cdurl"),
            )
            self.document_reference = await self.save(s, document_reference)

            subscription = SubscriptionOrm(
                team_id=self.team.id,
                source_platform=SubscriptionSourcePlatform.slack,
                source_event=SubscriptionSourceEvent.slack_message,
                source_id=self.anystring("source_id"),
            )
            self.subscription = await self.save(s, subscription)

    async def test_delete_subscription(self) -> None:
        response = await self.make_request(
            DeleteSubscriptionRequest.config.path,
            headers={
                EAVE_TEAM_ID_HEADER: str(self.team.id),
            },
            payload=DeleteSubscriptionRequest.RequestBody(
                subscription=SubscriptionInput(
                    source=SubscriptionSource(
                        platform=self.subscription.source.platform,
                        event=self.subscription.source.event,
                        id=self.subscription.source.id,
                    ),
                ),
            ),
        )

        assert response.status_code == HTTPStatus.OK
        async with self.db_session.begin() as s:
            subscription = await SubscriptionOrm.one_or_none(
                session=s, source=self.subscription.source, team_id=self.team.id
            )

        assert subscription is None
