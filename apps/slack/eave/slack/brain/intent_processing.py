import eave.stdlib.core_api.models.subscriptions
import eave.stdlib.core_api.operations.subscriptions as eave_subscriptions
from eave.stdlib.logging import eaveLogger
from . import message_prompts
from .document_management import DocumentManagementMixin
from .subscription_management import SubscriptionManagementMixin
from ..config import SLACK_APP_CONFIG


class IntentProcessingMixin(DocumentManagementMixin, SubscriptionManagementMixin):
    async def handle_action(self, message_action: message_prompts.MessageAction) -> None:
        match message_action:
            case message_prompts.MessageAction.CREATE_DOCUMENTATION | message_prompts.MessageAction.WATCH:
                self.eave_ctx.feature_name = "slack_document_create"
                await self.create_documentation_and_subscribe()
                return

            case message_prompts.MessageAction.UNWATCH:
                self.eave_ctx.feature_name = "slack_unwatch_thread"
                await self.unwatch_conversation()
                return

            case message_prompts.MessageAction.SEARCH_DOCUMENTATION:
                self.eave_ctx.feature_name = "slack_document_search"
                await self.search_documentation()
                return

            case message_prompts.MessageAction.UPDATE_DOCUMENTATION:
                self.eave_ctx.feature_name = "slack_document_update"
                await self.update_documentation()
                return

            case message_prompts.MessageAction.REFINE_DOCUMENTATION:
                self.eave_ctx.feature_name = "slack_document_refine"
                await self.refine_documentation()
                return

            case message_prompts.MessageAction.DELETE_DOCUMENTATION:
                self.eave_ctx.feature_name = "slack_document_delete"
                await self.archive_documentation()
                return

            case message_prompts.MessageAction.NONE:
                return

            case _:
                await self.handle_unknown_request()
                return

    async def handle_unknown_request(self) -> None:
        """
        Processes a request that wasn't recognized.
        Basically lets the user know that I wasn't able to process the message, and reminds them if I'm already documenting this conversation.
        """
        subscription_response = await self.get_subscription()

        eaveLogger.warning(
            "Unknown request to Eave in Slack",
            self.eave_ctx,
            {"message": self.message.text},
        )
        await self.log_event(
            event_name="eave_received_unknown_request",
            event_description="Eave received a request that she didn't know how to handle.",
        )

        # TODO: Create a Jira ticket (or similar) when Eave doesn't know how to handle a message.

        if subscription_response.subscription is None:
            await self.send_response(
                text=(
                    "Hey! I haven't been trained on how to respond to your message. I've let my development team know about it. "
                    "If you needed something else, try phrasing it differently."
                ),
                eave_message_purpose="responding to unknown request",
            )

            # TODO: handle the response to this, eg if the user says "Yes please" or "No thanks"

        elif subscription_response.document_reference is not None:
            await self.send_response(
                text=(
                    "Hey! I haven't been trained on how to respond to your message. I've let my development team know about it. "
                    f"As a reminder, I'm watching this conversation and documenting the information <{subscription_response.document_reference.document_url}|here>. "
                    "If you needed something else, try phrasing it differently."
                ),
                eave_message_purpose="responding to unknown request",
            )

        else:
            await self.send_response(
                text=(
                    "Hey! I haven't been trained on how to respond to your message. I've let my development team know about it. "
                    "I'm currently working on the documentation for this conversation, and I'll send an update when it's ready. "
                    "If you needed something else, try phrasing it differently."
                ),
                eave_message_purpose="responding to unknown request",
            )

    async def unwatch_conversation(self) -> None:
        await eave_subscriptions.DeleteSubscriptionRequest.perform(
            ctx=self.eave_ctx,
            origin=SLACK_APP_CONFIG.eave_origin,
            team_id=self.eave_team.id,
            input=eave_subscriptions.DeleteSubscriptionRequest.RequestBody(
                subscription=eave.stdlib.core_api.models.subscriptions.SubscriptionInput(
                    source=self.message.subscription_source
                ),
            ),
        )

        await self.log_event(
            event_name="eave_unwatched_conversation",
            event_description="Eave stopped watching a conversation",
        )
