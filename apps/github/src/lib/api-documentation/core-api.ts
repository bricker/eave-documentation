import {
  GithubDocument,
  GithubDocumentStatus,
  GithubDocumentType,
  GithubDocumentValuesInput,
} from "@eave-fyi/eave-stdlib-ts/src/core-api/models/github-documents.js";
import { GithubRepo } from "@eave-fyi/eave-stdlib-ts/src/core-api/models/github-repos.js";
import { Team } from "@eave-fyi/eave-stdlib-ts/src/core-api/models/team.js";
import {
  CreateGithubDocumentOperation,
  GetGithubDocumentsOperation,
  UpdateGithubDocumentOperation,
} from "@eave-fyi/eave-stdlib-ts/src/core-api/operations/github-documents.js";
import { GetGithubReposOperation } from "@eave-fyi/eave-stdlib-ts/src/core-api/operations/github-repos.js";
import { GetTeamOperation } from "@eave-fyi/eave-stdlib-ts/src/core-api/operations/team.js";
import {
  LogContext,
  eaveLogger,
} from "@eave-fyi/eave-stdlib-ts/src/logging.js";
import { CtxArg } from "@eave-fyi/eave-stdlib-ts/src/requests.js";
import { JsonValue } from "@eave-fyi/eave-stdlib-ts/src/types.js";
import assert from "assert";
import { appConfig } from "../../config.js";

type GithubDocumentTable = { [key: string]: GithubDocument };

export class CoreAPIData {
  readonly logParams: { [key: string]: JsonValue };
  readonly teamId: string;
  readonly externalRepoId: string;
  private readonly ctx: LogContext;

  private __memo__eaveGithubDocuments?: GithubDocumentTable;
  private __memo__eaveTeam?: Team;
  private __memo__eaveGithubRepo?: GithubRepo;

  constructor({
    teamId,
    externalRepoId,
    ctx,
  }: CtxArg & {
    teamId: string;
    externalRepoId: string;
  }) {
    this.ctx = ctx;
    this.teamId = teamId;
    this.externalRepoId = externalRepoId;
    this.logParams = {};
  }

  async getEaveGithubRepo(): Promise<GithubRepo> {
    if (this.__memo__eaveGithubRepo !== undefined) {
      return this.__memo__eaveGithubRepo;
    }
    const response = await GetGithubReposOperation.perform({
      origin: appConfig.eaveOrigin,
      teamId: this.teamId,
      input: {
        repos: [{ external_repo_id: this.externalRepoId }],
      },
      ctx: this.ctx,
    });

    if (response.repos.length > 1) {
      eaveLogger.warning(
        `Unexpected multiple repos for id ${this.externalRepoId}`,
        this.ctx,
      );
    }

    const eaveGithubRepo = response.repos[0];
    assert(
      eaveGithubRepo,
      `No repo found in Eave for ID ${this.externalRepoId}`,
    );

    this.logParams["eave_github_repo"] = eaveGithubRepo;
    this.__memo__eaveGithubRepo = eaveGithubRepo;
    return this.__memo__eaveGithubRepo;
  }

  async getTeam(): Promise<Team> {
    if (this.__memo__eaveTeam !== undefined) {
      return this.__memo__eaveTeam;
    }

    const response = await GetTeamOperation.perform({
      origin: appConfig.eaveOrigin,
      teamId: this.teamId,
      ctx: this.ctx,
    });
    const team = response.team;
    this.logParams["eave_team"] = team;
    this.__memo__eaveTeam = team;
    return this.__memo__eaveTeam;
  }

  async getGithubDocuments(): Promise<GithubDocumentTable> {
    if (this.__memo__eaveGithubDocuments !== undefined) {
      return this.__memo__eaveGithubDocuments;
    }

    const eaveGithubRepo = await this.getEaveGithubRepo();
    const response = await GetGithubDocumentsOperation.perform({
      input: {
        query_params: {
          github_repo_id: eaveGithubRepo.id,
          type: GithubDocumentType.API_DOCUMENT,
        },
      },
      origin: appConfig.eaveOrigin,
      teamId: this.teamId,
      ctx: this.ctx,
    });

    const existingGithubDocuments: GithubDocumentTable = {};

    response.documents.forEach((doc) => {
      if (doc.file_path) {
        const key = githubDocumentKey({
          filePath: doc.file_path,
          externalRepoId: eaveGithubRepo.external_repo_id,
        });
        existingGithubDocuments[key] = doc;
      }
    });

    this.logParams["existing_documents"] = existingGithubDocuments;
    this.__memo__eaveGithubDocuments = existingGithubDocuments;
    return this.__memo__eaveGithubDocuments;
  }

  async createPlaceholderGithubDocument({
    apiName,
    documentationFilePath,
  }: {
    apiName: string;
    documentationFilePath: string;
  }): Promise<GithubDocument> {
    const eaveGithubRepo = await this.getEaveGithubRepo();

    const response = await CreateGithubDocumentOperation.perform({
      origin: appConfig.eaveOrigin,
      ctx: this.ctx,
      teamId: this.teamId,
      input: {
        repo: {
          id: eaveGithubRepo.id,
        },
        document: {
          type: GithubDocumentType.API_DOCUMENT,
          status: GithubDocumentStatus.PROCESSING,
          api_name: apiName,
          file_path: documentationFilePath,
          pull_request_number: null,
        },
      },
    });

    await this.setGithubDocument({ document: response.document });
    return response.document;
  }

  async updateGithubDocument({
    document,
    newValues,
  }: {
    document: GithubDocument;
    newValues: GithubDocumentValuesInput;
  }): Promise<GithubDocument> {
    const response = await UpdateGithubDocumentOperation.perform({
      input: {
        document: {
          id: document.id,
          new_values: newValues,
        },
      },
      origin: appConfig.eaveOrigin,
      teamId: this.teamId,
      ctx: this.ctx,
    });

    await this.setGithubDocument({ document: response.document });
    return response.document;
  }

  async setGithubDocument({ document }: { document: GithubDocument }) {
    if (document.file_path !== null) {
      // TODO: What to do if it's null?
      const key = githubDocumentKey({
        filePath: document.file_path,
        externalRepoId: this.externalRepoId,
      });

      const githubDocuments = await this.getGithubDocuments();
      githubDocuments[key] = document;
    }
  }

  async getGithubDocument({
    filePath,
  }: {
    filePath: string;
  }): Promise<GithubDocument | undefined> {
    const key = githubDocumentKey({
      filePath,
      externalRepoId: this.externalRepoId,
    });

    const githubDocuments = await this.getGithubDocuments();
    return githubDocuments[key];
  }
}

function githubDocumentKey({
  externalRepoId,
  filePath,
}: {
  externalRepoId: string;
  filePath: string;
}): string {
  return `${externalRepoId}/${filePath}`;
}
