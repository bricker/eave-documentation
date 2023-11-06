import { RequestArgsOrigin, makeRequest } from "../../requests.js";
import { GithubAppEndpointConfiguration } from "./shared.js";

export type VerifyInstallationRequestBody = {
  code: string;
  installation_id: string;
};

export class VerifyInstallationOperation {
  static config = new GithubAppEndpointConfiguration({
    path: "/github/api/verify",
    authRequired: false,
    teamIdRequired: false,
  });

  static async perform(
    args: RequestArgsOrigin & {
      input: VerifyInstallationRequestBody;
    },
  ): Promise<void> {
    await makeRequest({
      config: this.config,
      ...args,
    });
  }
}
