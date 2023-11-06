import {
  RequestArgsOrigin,
  RequestArgsTeamId,
  makeRequest,
} from "../../requests.js";
import {
  GithubInstallation,
  GithubInstallationInput,
} from "../models/github.js";
import { Team } from "../models/team.js";
import { CoreApiEndpointConfiguration } from "./shared.js";

export type GetGithubInstallationRequestBody = {
  github_integration: GithubInstallationInput;
};

export type GetGithubInstallationResponseBody = {
  team: Team | null;
  github_integration: GithubInstallation;
};

export class GetGithubInstallationOperation {
  static config = new CoreApiEndpointConfiguration({
    path: "/integrations/github/query",
  });

  static async perform(
    args: RequestArgsOrigin & { input: GetGithubInstallationRequestBody },
  ): Promise<GetGithubInstallationResponseBody> {
    const resp = await makeRequest({
      config: this.config,
      ...args,
    });
    const responseData = <GetGithubInstallationResponseBody>await resp.json();
    return responseData;
  }
}

export type DeleteGithubInstallationRequestBody = {
  github_integration: GithubInstallationInput;
};

export class DeleteGithubInstallationOperation {
  static config = new CoreApiEndpointConfiguration({
    path: "/integrations/github/delete",
  });

  static async perform(
    args: RequestArgsTeamId & { input: DeleteGithubInstallationRequestBody },
  ): Promise<void> {
    await makeRequest({
      config: this.config,
      ...args,
    });
  }
}
