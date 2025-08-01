from eave.core.internal.oauth.atlassian import ATLASSIAN_OAUTH_AUTHORIZE_PATH, ATLASSIAN_OAUTH_CALLBACK_PATH
from eave.core.internal.oauth.google import GOOGLE_OAUTH_AUTHORIZE_PATH, GOOGLE_OAUTH_CALLBACK_PATH
from eave.core.internal.oauth.slack import SLACK_OAUTH_AUTHORIZE_PATH, SLACK_OAUTH_CALLBACK_PATH
from eave.core.public.middleware.authentication import AuthASGIMiddleware
from eave.core.public.middleware.team_lookup import TeamLookupASGIMiddleware
from eave.core.public.requests import connect_integration, github_repos, github_documents, api_documentation_jobs
from eave.core.public.requests.atlassian_integration import AtlassianIntegration
from eave.core.public.requests.data_ingestion import DataIngestionEndpoint
from eave.stdlib import cache, logging
from eave.stdlib.core_api.operations.account import GetAuthenticatedAccount
from eave.stdlib.core_api.operations.api_documentation_jobs import (
    GetApiDocumentationJobsOperation,
    UpsertApiDocumentationJobOperation,
)
from eave.stdlib.core_api.operations.documents import DeleteDocument, SearchDocuments, UpsertDocument
from eave.stdlib.core_api.operations.atlassian import GetAtlassianInstallation
from eave.stdlib.core_api.operations.github import GetGithubInstallation, DeleteGithubInstallation
from eave.stdlib.core_api.operations.slack import GetSlackInstallation
from eave.stdlib.core_api.operations import CoreApiEndpointConfiguration
from eave.stdlib.core_api.operations.subscriptions import (
    CreateSubscriptionRequest,
    DeleteSubscriptionRequest,
    GetSubscriptionRequest,
)
from eave.stdlib.core_api.operations.github_documents import (
    CreateGithubDocumentRequest,
    GetGithubDocumentsRequest,
    UpdateGithubDocumentRequest,
    DeleteGithubDocumentsByIdsRequest,
    DeleteGithubDocumentsByTypeRequest,
)
from eave.stdlib.core_api.operations.github_repos import (
    CreateGithubRepoRequest,
    GetAllTeamsGithubReposRequest,
    GetGithubReposRequest,
    UpdateGithubReposRequest,
    DeleteGithubReposRequest,
    FeatureStateGithubReposRequest,
)
from eave.stdlib.core_api.operations.team import UpsertConfluenceDestinationAuthedRequest, GetTeamRequest
from eave.stdlib.core_api.operations.connect import QueryConnectIntegrationRequest, RegisterConnectIntegrationRequest
from eave.stdlib.middleware.origin import OriginASGIMiddleware
from eave.stdlib.middleware.signature_verification import SignatureVerificationASGIMiddleware
import eave.stdlib.time
import starlette.applications
import starlette.endpoints
from asgiref.typing import ASGI3Application
from starlette.routing import Route

import eave.core.public.requests.github_integration

from .public.exception_handlers import exception_handlers
from .public.requests import authed_account, documents, noop, slack_integration, subscriptions, team, status
from .public.requests.oauth import atlassian_oauth, github_oauth, google_oauth, slack_oauth
from .internal.database import async_engine
from eave.stdlib.middleware import common_middlewares

eave.stdlib.time.set_utc()


def make_route(
    config: CoreApiEndpointConfiguration,
    endpoint: ASGI3Application,
) -> Route:
    """
    Defines basic information about the route, passed-through to the Starlette router.
    More importantly, defines which headers are required and validated for this route.
    By default, all headers are required. This is an attempt to prevent a developer error from bypassing security mechanisms.
    """

    """
    The order of these is important! Inner middlewares may have dependencies on outer middlewares.
    The middlewares are ordered here from "inner" to "outer".
    Although we are _initializing_ the middlewares here, we're not _calling_ them.
    It's important to remember that a Middleware is just a Callable object that takes ASGI-specific arguments.
    When we "initialize" a Middleware, we're really just creating a pre-configured Callable.
    It is common to have a Middleware that isn't initialized in this way, and instead a class itself is provided as the Callable.
    In that case, the class's initializer would take the necessary ASGI arguments.

    Consider that for most of these middlewares, the procedure goes something like this:

        1. Middleware (i.e. Callable) is called and given the current request
        1. Middleware modifies the request in some way
        1. Middleware calls the next middleware in the chain, passing the modified request

    With that in mind, consider this example middleware chain:

        1. RequestLoggerMiddleware   # A callable that receives the request and logs the information
        1. BodyParserMiddleware      # A callable that receives the request, parses the body, and attaches the parsed body to the request object
        1. BodyValidationMiddleware  # A callable that receives the request (with the parsed body attached) and validates the data in the body

    This middleware chain should be created like this, _seemingly_ in reverse order:

        endpoint = MyRouteHandler()
        endpoint = BodyValidationMiddleware(app=endpoint)
        endpoint = BodyParserMiddleware(app=endpoint)
        endpoint = RequestLoggerMiddleware(app=endpoint) # < This is the final "endpoint" that gets called by the ASGI server

    BodyValidationMiddleware directly wraps MyRouteHandler, because the validation is the _last_ thing that happens before the route handler runs.
    Similarly, BodyParserMiddleware wraps BodyValidationMiddleware, because the body needs to be parsed before it can be validated.
    And finally, the RequstLoggerMiddleware wraps everything, because it should log the request information before anything else happens.

    Internally, the Middlewares do their work and then hand off the request to the next middleware.
    Although a Middleware is just a Callable, in most cases it needs to be an instance of a class so that it has a reference to the next middleware.
    Often this is an object called "app" attached to the instance.
    In these examples the name "next" is used to help with understanding, but is a reserved keyword in Python so not commonly used.

    Here's what the initialization for the above middleware chain would look like if done all in one call:

        ASGI(
            next = RequestLoggerMiddleware(
                next = BodyParserMiddleware(
                    next = BodyValidationMiddleware(
                        next = MyRouteHandler
        ))))

    Note that MyRouteHandler is not an instance in this example, because it is the last Callable in the chain and
    doesn't need a reference to any other callables.

    The classes might look like this (arguments are simplified for this example)

        class ASGI:
            next: RequestLoggerMiddleware
            def __call__(self, request):
                self.next(request)

        class RequestLoggerMiddleware:
            next: BodyParserMiddleware
            def __call__(self, request):
                logger.log('received request')
                self.next(request)

        class BodyParserMiddleware:
            next: BodyValidationMiddleware
            def __call__(self, request):
                parsed_body = json.loads(request.body)
                request.state.parsed_body = parsed_body
                self.next(request)

        class BodyValidationMiddleware:
            next: MyRouteHandler
            def __call__(self, request):
                parsed_body = request.state.parsed_body
                assert parsed_body["name"] is not None, "Name is required"
                self.next(request)

        class MyRouteHandler:
            def __init__(self, request):
                parsed_body = request.state.parsed_body
                save_to_database(parsed_body)
                return Response(status_code=200)

    So, that's a long-winded explanation of the order of the middlewares below.
    """

    endpoint = TeamLookupASGIMiddleware(
        app=endpoint, endpoint_config=config
    )  # Last thing to happen before the Route handler
    endpoint = AuthASGIMiddleware(app=endpoint, endpoint_config=config)
    endpoint = SignatureVerificationASGIMiddleware(app=endpoint, endpoint_config=config)
    endpoint = OriginASGIMiddleware(
        app=endpoint, endpoint_config=config
    )  # First thing to happen when the middleware chain is kicked off

    return Route(path=config.path, endpoint=endpoint)


routes = [
    Route(path="/_ah/warmup", endpoint=status.WarmupRequest, methods=["GET"]),
    Route(path="/_ah/start", endpoint=status.StartRequest, methods=["GET"]),
    Route(path="/_ah/stop", endpoint=status.StopRequest, methods=["GET"]),
    Route(path="/status", endpoint=status.StatusRequest, methods=["GET", "POST", "DELETE", "HEAD", "OPTIONS"]),
    # Public API Endpoints
    make_route(
        config=CoreApiEndpointConfiguration(
            path="/ingest",
            auth_required=False,
            signature_required=False,
            origin_required=False,
            team_id_required=False,
        ),
        endpoint=DataIngestionEndpoint,
    ),
    # Internal API Endpoints.
    # These endpoints require signature verification.
    make_route(
        config=UpsertDocument.config,
        endpoint=documents.UpsertDocument,
    ),
    make_route(
        config=SearchDocuments.config,
        endpoint=documents.SearchDocuments,
    ),
    make_route(
        config=DeleteDocument.config,
        endpoint=documents.DeleteDocument,
    ),
    make_route(
        config=CreateSubscriptionRequest.config,
        endpoint=subscriptions.CreateSubscription,
    ),
    make_route(
        config=GetSubscriptionRequest.config,
        endpoint=subscriptions.GetSubscription,
    ),
    make_route(
        config=DeleteSubscriptionRequest.config,
        endpoint=subscriptions.DeleteSubscription,
    ),
    make_route(
        config=RegisterConnectIntegrationRequest.config,
        endpoint=connect_integration.RegisterConnectIntegrationEndpoint,
    ),
    make_route(
        config=QueryConnectIntegrationRequest.config,
        endpoint=connect_integration.QueryConnectIntegrationEndpoint,
    ),
    make_route(
        config=GetSlackInstallation.config,
        endpoint=slack_integration.SlackIntegration,
    ),
    make_route(
        config=GetGithubInstallation.config,
        endpoint=eave.core.public.requests.github_integration.GetGithubIntegrationEndpoint,
    ),
    make_route(
        config=DeleteGithubInstallation.config,
        endpoint=eave.core.public.requests.github_integration.DeleteGithubIntegrationEndpoint,
    ),
    make_route(
        config=GetAtlassianInstallation.config,
        endpoint=AtlassianIntegration,
    ),
    make_route(
        config=GetTeamRequest.config,
        endpoint=team.GetTeamEndpoint,
    ),
    make_route(
        config=CreateGithubRepoRequest.config,
        endpoint=github_repos.CreateGithubRepoEndpoint,
    ),
    make_route(
        config=GetGithubReposRequest.config,
        endpoint=github_repos.GetGithubRepoEndpoint,
    ),
    make_route(
        config=GetAllTeamsGithubReposRequest.config,
        endpoint=github_repos.GetAllTeamsGithubRepoEndpoint,
    ),
    make_route(
        config=FeatureStateGithubReposRequest.config,
        endpoint=github_repos.FeatureStateGithubReposEndpoint,
    ),
    make_route(
        config=UpsertApiDocumentationJobOperation.config,
        endpoint=api_documentation_jobs.UpsertApiDocumentationJobsEndpoint,
    ),
    make_route(
        config=GetApiDocumentationJobsOperation.config,
        endpoint=api_documentation_jobs.GetApiDocumentationJobEndpoint,
    ),
    # Authenticated API endpoints.
    make_route(
        config=CreateGithubDocumentRequest.config,
        endpoint=github_documents.CreateGithubDocumentEndpoint,
    ),
    make_route(
        config=GetGithubDocumentsRequest.config,
        endpoint=github_documents.GetGithubDocumentsEndpoint,
    ),
    make_route(
        config=UpdateGithubDocumentRequest.config,
        endpoint=github_documents.UpdateGithubDocumentEndpoint,
    ),
    make_route(
        config=DeleteGithubDocumentsByIdsRequest.config,
        endpoint=github_documents.DeleteGithubDocumentsByIdsEndpoint,
    ),
    make_route(
        config=DeleteGithubDocumentsByTypeRequest.config,
        endpoint=github_documents.DeleteGithubDocumentsByTypeEndpoint,
    ),
    make_route(
        config=UpdateGithubReposRequest.config,
        endpoint=github_repos.UpdateGithubReposEndpoint,
    ),
    make_route(
        config=DeleteGithubReposRequest.config,
        endpoint=github_repos.DeleteGithubReposEndpoint,
    ),
    make_route(
        config=UpsertConfluenceDestinationAuthedRequest.config,
        endpoint=team.UpsertConfluenceDestinationAuthedEndpoint,
    ),
    make_route(
        config=GetAuthenticatedAccount.config,
        endpoint=authed_account.GetAuthedAccount,
    ),
    # OAuth endpoints.
    # These endpoints don't require any verification (except the OAuth flow itself)
    make_route(
        config=CoreApiEndpointConfiguration(
            path=GOOGLE_OAUTH_AUTHORIZE_PATH,
            auth_required=False,
            signature_required=False,
            origin_required=False,
            team_id_required=False,
        ),
        endpoint=google_oauth.GoogleOAuthAuthorize,
    ),
    make_route(
        config=CoreApiEndpointConfiguration(
            path=GOOGLE_OAUTH_CALLBACK_PATH,
            auth_required=False,
            signature_required=False,
            origin_required=False,
            team_id_required=False,
        ),
        endpoint=google_oauth.GoogleOAuthCallback,
    ),
    make_route(
        config=CoreApiEndpointConfiguration(
            path=SLACK_OAUTH_AUTHORIZE_PATH,
            auth_required=False,
            signature_required=False,
            origin_required=False,
            team_id_required=False,
        ),
        endpoint=slack_oauth.SlackOAuthAuthorize,
    ),
    make_route(
        config=CoreApiEndpointConfiguration(
            path=SLACK_OAUTH_CALLBACK_PATH,
            auth_required=False,
            signature_required=False,
            origin_required=False,
            team_id_required=False,
        ),
        endpoint=slack_oauth.SlackOAuthCallback,
    ),
    make_route(
        config=CoreApiEndpointConfiguration(
            path=ATLASSIAN_OAUTH_AUTHORIZE_PATH,
            auth_required=False,
            signature_required=False,
            origin_required=False,
            team_id_required=False,
        ),
        endpoint=atlassian_oauth.AtlassianOAuthAuthorize,
    ),
    make_route(
        config=CoreApiEndpointConfiguration(
            path=ATLASSIAN_OAUTH_CALLBACK_PATH,
            auth_required=False,
            signature_required=False,
            origin_required=False,
            team_id_required=False,
        ),
        endpoint=atlassian_oauth.AtlassianOAuthCallback,
    ),
    make_route(
        config=CoreApiEndpointConfiguration(
            path=github_oauth.GITHUB_OAUTH_AUTHORIZE_PATH,
            auth_required=False,
            signature_required=False,
            origin_required=False,
            team_id_required=False,
        ),
        endpoint=github_oauth.GithubOAuthAuthorize,
    ),
    make_route(
        config=CoreApiEndpointConfiguration(
            path=github_oauth.GITHUB_OAUTH_CALLBACK_PATH,
            auth_required=False,
            signature_required=False,
            origin_required=False,
            team_id_required=False,
        ),
        endpoint=github_oauth.GithubOAuthCallback,
    ),
    make_route(
        config=CoreApiEndpointConfiguration(
            path="/favicon.ico",
            auth_required=False,
            signature_required=False,
            origin_required=False,
            team_id_required=False,
        ),
        endpoint=noop.NoopRequest,
    ),
]


async def graceful_shutdown() -> None:
    await async_engine.dispose()

    try:
        if client := cache.initialized_client():
            await client.close()
    except Exception as e:
        logging.eaveLogger.exception(e)


app = starlette.applications.Starlette(
    middleware=common_middlewares,
    routes=routes,
    exception_handlers=exception_handlers,
    on_shutdown=[graceful_shutdown],
)
