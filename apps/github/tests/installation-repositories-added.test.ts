import {
  GithubRepo,
  GithubRepoFeature,
  GithubRepoFeatureState,
} from "@eave-fyi/eave-stdlib-ts/src/core-api/models/github-repos.js";
import { Team } from "@eave-fyi/eave-stdlib-ts/src/core-api/models/team.js";
import {
  CreateGithubRepoOperation,
  FeatureStateGithubReposOperation,
  GetGithubReposOperation,
} from "@eave-fyi/eave-stdlib-ts/src/core-api/operations/github-repos.js";
import {
  GetGithubInstallationOperation,
  GetGithubInstallationResponseBody,
} from "@eave-fyi/eave-stdlib-ts/src/core-api/operations/github.js";
import { RunApiDocumentationTaskOperation } from "@eave-fyi/eave-stdlib-ts/src/github-api/operations/run-api-documentation-task.js";
import { LogContext } from "@eave-fyi/eave-stdlib-ts/src/logging.js";
import {
  TestContextBase,
  TestUtil,
} from "@eave-fyi/eave-stdlib-ts/src/test-util.js";
import { InstallationRepositoriesAddedEvent } from "@octokit/webhooks-types";
import anyTest, { TestFn } from "ava";
import sinon from "sinon";
import { maybeAddReposToDataBase } from "../src/events/installation-repositories-added.js";

interface TestContext extends TestContextBase {
  sandbox: sinon.SinonSandbox;
}

const test = anyTest as TestFn<TestContext>;

function anyTeam(t: TestUtil): Team {
  return {
    id: t.anystr(),
    name: t.anystr(),
    document_platform: null,
  };
}

function anyRepo(t: TestUtil): GithubRepo {
  return {
    id: t.anystr(),
    team_id: t.anystr(),
    external_repo_id: t.anystr(),
    display_name: null,
    github_installation_id: t.anystr(),
    inline_code_documentation_state: GithubRepoFeatureState.DISABLED,
    architecture_documentation_state: GithubRepoFeatureState.DISABLED,
    api_documentation_state: GithubRepoFeatureState.DISABLED,
  };
}

function anyGithubInstallationResponse(
  t: TestUtil,
): GetGithubInstallationResponseBody {
  const team_id = t.anystr();
  return {
    team: { id: team_id, name: t.anystr(), document_platform: null },
    github_integration: {
      id: t.anystr("github_installation_id"),
      github_install_id: t.anystr(),
      team_id,
    },
  };
}

test.beforeEach((t) => {
  const sandbox = sinon.createSandbox();
  const util = new TestUtil();

  t.context = {
    sandbox,
    u: util,
  };
});

test.afterEach.always((t) => {
  t.context.sandbox.restore();
});

test.serial(
  "no existing github_repos for team should not insert rows",
  async (t) => {
    // GIVEN there are no entries in github_repos db for this team
    const getGithubReposStub = t.context.sandbox
      .stub(GetGithubReposOperation, "perform")
      .returns(Promise.resolve({ repos: [] }));
    const featureStatesStub = t.context.sandbox.stub(
      FeatureStateGithubReposOperation,
      "perform",
    );
    const createGithubRepoStub = t.context.sandbox.stub(
      CreateGithubRepoOperation,
      "perform",
    );
    const runApiDocsStub = t.context.sandbox.stub(
      RunApiDocumentationTaskOperation,
      "perform",
    );

    // WHEN the Eave gh app is given access to a new repo
    // Force-casting here to avoid having to pass in all the unused fields
    const event = <InstallationRepositoriesAddedEvent>{
      repositories_added: [
        {
          node_id: t.context.u.anystr("repo1 id"),
          name: t.context.u.anystr("repo1 name"),
        },
      ],
    };
    await maybeAddReposToDataBase({
      event,
      ctx: LogContext.wrap(),
      eaveTeam: anyTeam(t.context.u),
    });

    // THEN no action is taken (beyond checking for existing entries in the db)
    t.deepEqual(getGithubReposStub.callCount, 1);
    t.assert(featureStatesStub.notCalled);
    t.assert(createGithubRepoStub.notCalled);
    t.assert(runApiDocsStub.notCalled);
  },
);

test.serial(
  "all repos have feature enabled then new repo will also have feature enabled",
  async (t) => {
    // GIVEN this team has existing repos with all inline_code_docs feature states ENABLED
    const getGithubReposStub = t.context.sandbox
      .stub(GetGithubReposOperation, "perform")
      .returns(Promise.resolve({ repos: [anyRepo(t.context.u)] }));
    t.context.sandbox
      .stub(GetGithubInstallationOperation, "perform")
      .returns(Promise.resolve(anyGithubInstallationResponse(t.context.u)));
    const featureStatesStub = t.context.sandbox.stub(
      FeatureStateGithubReposOperation,
      "perform",
    );
    featureStatesStub
      .returns(Promise.resolve({ states_match: false })) // default return value
      .withArgs(
        sinon.match({
          input: {
            query_params: {
              feature: GithubRepoFeature.INLINE_CODE_DOCUMENTATION,
            },
          },
        }),
      )
      .returns(Promise.resolve({ states_match: true })); // special return for withArgs
    const createGithubRepoStub = t.context.sandbox
      .stub(CreateGithubRepoOperation, "perform")
      .returns(Promise.resolve({ repo: anyRepo(t.context.u) }));
    const runApiDocsStub = t.context.sandbox.stub(
      RunApiDocumentationTaskOperation,
      "perform",
    );

    const event: any = {
      repositories_added: [
        {
          node_id: t.context.u.anystr("repo1 id"),
          name: t.context.u.anystr("repo1 name"),
        },
      ],
      installation: {
        id: t.context.u.anystr(),
      },
    }; // InstallationRepositoriesAddedEvent;

    // WHEN the Eave gh app is given access to a new repo
    await maybeAddReposToDataBase({
      event,
      ctx: LogContext.wrap(),
      eaveTeam: anyTeam(t.context.u),
    });

    // THEN the db row is created
    t.deepEqual(getGithubReposStub.callCount, 1);
    t.deepEqual(featureStatesStub.callCount, 2);
    t.assert(
      createGithubRepoStub.calledOnceWith(
        sinon.match({
          input: {
            repo: {
              external_repo_id: t.context.u.getstr("repo1 id"),
              display_name: t.context.u.getstr("repo1 name"),
              api_documentation_state: GithubRepoFeatureState.DISABLED,
              inline_code_documentation_state: GithubRepoFeatureState.ENABLED,
              architecture_documentation_state: GithubRepoFeatureState.DISABLED,
            },
          },
        }),
      ),
    );
    t.assert(runApiDocsStub.notCalled);
  },
);

test.serial(
  "multiple repos added at once lead to multiple db row creations",
  async (t) => {
    // GIVEN this team has existing repos with all inline_code_docs feature states ENABLED
    const getGithubReposStub = t.context.sandbox
      .stub(GetGithubReposOperation, "perform")
      .returns(Promise.resolve({ repos: [anyRepo(t.context.u)] }));
    t.context.sandbox
      .stub(GetGithubInstallationOperation, "perform")
      .returns(Promise.resolve(anyGithubInstallationResponse(t.context.u)));
    const featureStatesStub = t.context.sandbox.stub(
      FeatureStateGithubReposOperation,
      "perform",
    );
    featureStatesStub
      .returns(Promise.resolve({ states_match: false })) // default return value
      .withArgs(
        sinon.match({
          input: {
            query_params: {
              feature: GithubRepoFeature.INLINE_CODE_DOCUMENTATION,
            },
          },
        }),
      )
      .returns(Promise.resolve({ states_match: true })); // special return for withArgs
    const createGithubRepoStub = t.context.sandbox
      .stub(CreateGithubRepoOperation, "perform")
      .returns(Promise.resolve({ repo: anyRepo(t.context.u) }));
    const runApiDocsStub = t.context.sandbox.stub(
      RunApiDocumentationTaskOperation,
      "perform",
    );

    const event: any = {
      repositories_added: [
        {
          node_id: t.context.u.anystr("repo1 id"),
          name: t.context.u.anystr("repo1 name"),
        },
        {
          node_id: t.context.u.anystr("repo2 id"),
          name: t.context.u.anystr("repo2 name"),
        },
      ],
      installation: {
        id: t.context.u.anystr(),
      },
    };

    // WHEN the Eave gh app is given access to multiple new repos
    await maybeAddReposToDataBase({
      event,
      ctx: LogContext.wrap(),
      eaveTeam: anyTeam(t.context.u),
    });

    // THEN the multiple db rows are created
    t.deepEqual(getGithubReposStub.callCount, 1);
    t.deepEqual(featureStatesStub.callCount, 4);
    t.deepEqual(createGithubRepoStub.callCount, 2);
    t.assert(
      createGithubRepoStub.firstCall.calledWithMatch(
        sinon.match({
          input: {
            repo: {
              external_repo_id: t.context.u.getstr("repo1 id"),
              display_name: t.context.u.getstr("repo1 name"),
              github_installation_id: t.context.u.getstr(
                "github_installation_id",
              ),
              api_documentation_state: GithubRepoFeatureState.DISABLED,
              inline_code_documentation_state: GithubRepoFeatureState.ENABLED,
              architecture_documentation_state: GithubRepoFeatureState.DISABLED,
            },
          },
        }),
      ),
    );
    t.assert(
      createGithubRepoStub.secondCall.calledWithMatch(
        sinon.match({
          input: {
            repo: {
              external_repo_id: t.context.u.getstr("repo2 id"),
              display_name: t.context.u.getstr("repo2 name"),
              github_installation_id: t.context.u.getstr(
                "github_installation_id",
              ),
              api_documentation_state: GithubRepoFeatureState.DISABLED,
              inline_code_documentation_state: GithubRepoFeatureState.ENABLED,
              architecture_documentation_state: GithubRepoFeatureState.DISABLED,
            },
          },
        }),
      ),
    );
    t.assert(runApiDocsStub.notCalled);
  },
);

test.serial(
  "any repo has feature disabled then new repo will not have feature enabled",
  async (t) => {
    // GIVEN this team has existing repos that don't all have the ENABLED feature state for any features
    const getGithubReposStub = t.context.sandbox
      .stub(GetGithubReposOperation, "perform")
      .returns(Promise.resolve({ repos: [anyRepo(t.context.u)] }));
    t.context.sandbox
      .stub(GetGithubInstallationOperation, "perform")
      .returns(Promise.resolve(anyGithubInstallationResponse(t.context.u)));
    const featureStatesStub = t.context.sandbox
      .stub(FeatureStateGithubReposOperation, "perform")
      .returns(Promise.resolve({ states_match: false }));
    const createGithubRepoStub = t.context.sandbox
      .stub(CreateGithubRepoOperation, "perform")
      .returns(Promise.resolve({ repo: anyRepo(t.context.u) }));
    const runApiDocsStub = t.context.sandbox.stub(
      RunApiDocumentationTaskOperation,
      "perform",
    );

    const event: any = {
      repositories_added: [
        {
          node_id: t.context.u.anystr("repo1 id"),
          name: t.context.u.anystr("repo1 name"),
        },
      ],
      installation: {
        id: t.context.u.anystr(),
      },
    };

    // WHEN the Eave gh app is given access to a new repo
    await maybeAddReposToDataBase({
      event,
      ctx: LogContext.wrap(),
      eaveTeam: anyTeam(t.context.u),
    });

    // THEN the db row is created w/ all features disabled
    t.deepEqual(getGithubReposStub.callCount, 1);
    t.deepEqual(featureStatesStub.callCount, 2);
    t.assert(
      createGithubRepoStub.calledOnceWith(
        sinon.match({
          input: {
            repo: {
              external_repo_id: t.context.u.getstr("repo1 id"),
              display_name: t.context.u.getstr("repo1 name"),
              api_documentation_state: GithubRepoFeatureState.DISABLED,
              inline_code_documentation_state: GithubRepoFeatureState.DISABLED,
              architecture_documentation_state: GithubRepoFeatureState.DISABLED,
            },
          },
        }),
      ),
    );
    t.assert(runApiDocsStub.notCalled);
  },
);

test.serial(
  "new repos with api docs feature enabled get an initial run of the feature on creation",
  async (t) => {
    // GIVEN this team has existing repos with all api_docs feature states ENABLED
    const getGithubReposStub = t.context.sandbox
      .stub(GetGithubReposOperation, "perform")
      .returns(Promise.resolve({ repos: [anyRepo(t.context.u)] }));
    t.context.sandbox
      .stub(GetGithubInstallationOperation, "perform")
      .returns(Promise.resolve(anyGithubInstallationResponse(t.context.u)));
    const featureStatesStub = t.context.sandbox
      .stub(FeatureStateGithubReposOperation, "perform")
      .returns(Promise.resolve({ states_match: true }));
    const createdRepo = anyRepo(t.context.u);
    createdRepo.api_documentation_state = GithubRepoFeatureState.ENABLED;
    createdRepo.inline_code_documentation_state =
      GithubRepoFeatureState.ENABLED;
    const createGithubRepoStub = t.context.sandbox
      .stub(CreateGithubRepoOperation, "perform")
      .returns(Promise.resolve({ repo: createdRepo }));
    const runApiDocsStub = t.context.sandbox.stub(
      RunApiDocumentationTaskOperation,
      "perform",
    );

    const event: any = {
      repositories_added: [
        {
          node_id: t.context.u.anystr("repo1 id"),
          name: t.context.u.anystr("repo1 name"),
        },
        {
          node_id: t.context.u.anystr("repo2 id"),
          name: t.context.u.anystr("repo2 name"),
        },
      ],
      installation: {
        id: t.context.u.anystr(),
      },
    };

    // WHEN the Eave gh app is given access to multiple new repos
    await maybeAddReposToDataBase({
      event,
      ctx: LogContext.wrap(),
      eaveTeam: anyTeam(t.context.u),
    });

    // THEN the multiple db rows are created and the API docs feature is triggered for each
    t.deepEqual(getGithubReposStub.callCount, 1);
    t.deepEqual(featureStatesStub.callCount, 4);
    t.deepEqual(createGithubRepoStub.callCount, 2);
    t.assert(
      createGithubRepoStub.firstCall.calledWithMatch(
        sinon.match({
          input: {
            repo: {
              external_repo_id: t.context.u.getstr("repo1 id"),
              display_name: t.context.u.getstr("repo1 name"),
              github_installation_id: t.context.u.getstr(
                "github_installation_id",
              ),
              api_documentation_state: GithubRepoFeatureState.ENABLED,
              inline_code_documentation_state: GithubRepoFeatureState.ENABLED,
              architecture_documentation_state: GithubRepoFeatureState.DISABLED,
            },
          },
        }),
      ),
    );
    t.assert(
      createGithubRepoStub.secondCall.calledWithMatch(
        sinon.match({
          input: {
            repo: {
              external_repo_id: t.context.u.getstr("repo2 id"),
              display_name: t.context.u.getstr("repo2 name"),
              github_installation_id: t.context.u.getstr(
                "github_installation_id",
              ),
              api_documentation_state: GithubRepoFeatureState.ENABLED,
              inline_code_documentation_state: GithubRepoFeatureState.ENABLED,
              architecture_documentation_state: GithubRepoFeatureState.DISABLED,
            },
          },
        }),
      ),
    );
    t.deepEqual(runApiDocsStub.callCount, 2);
  },
);
