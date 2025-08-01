import { makeRequest, RequestArgsTeamId } from "../../requests.js";
import {
  ApiDocumentationJob,
  ApiDocumentationJobListInput,
  ApiDocumentationJobUpsertInput,
} from "../models/api-documentation-jobs.js";
import { CoreApiEndpointConfiguration } from "./shared.js";

export type GetApiDocumentationJobsRequestBody = {
  jobs?: ApiDocumentationJobListInput[];
};

export type GetApiDocumentationJobsResponseBody = {
  jobs: ApiDocumentationJob[];
};

export class GetApiDocumentationJobsOperation {
  static config = new CoreApiEndpointConfiguration({
    path: "/api-documentation-job/query",
  });
  /**
   * Performs an asynchronous request using provided arguments.
   *
   * @param args - An object that contains team ID and input as properties. The input is of type GetApiDocumentationJobsRequestBody.
   * @returns A promise that resolves to an object of type GetApiDocumentationJobsResponseBody.
   *
   * @static
   * @async
   */
  static async perform(
    args: RequestArgsTeamId & { input: GetApiDocumentationJobsRequestBody },
  ): Promise<GetApiDocumentationJobsResponseBody> {
    const resp = await makeRequest({
      config: this.config,
      ...args,
    });
    const responseData = <GetApiDocumentationJobsResponseBody>await resp.json();
    return responseData;
  }
}

export type UpsertApiDocumentationJobRequestBody = {
  job: ApiDocumentationJobUpsertInput;
};

export type UpsertApiDocumentationJobResponseBody = {
  job: ApiDocumentationJob;
};

export class UpsertApiDocumentationJobOperation {
  static config = new CoreApiEndpointConfiguration({
    path: "/api-documentation-job/upsert",
  });
  /**
   * Performs an asynchronous operation to upsert API documentation job.
   *
   * @param args - An object containing the team ID and the input for the API documentation job.
   * @returns A promise that resolves to the response body of the upsert API documentation job.
   */
  static async perform(
    args: RequestArgsTeamId & { input: UpsertApiDocumentationJobRequestBody },
  ): Promise<UpsertApiDocumentationJobResponseBody> {
    const resp = await makeRequest({
      config: this.config,
      ...args,
    });
    const responseData = <UpsertApiDocumentationJobResponseBody>(
      await resp.json()
    );
    return responseData;
  }
}
