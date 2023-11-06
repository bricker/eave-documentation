import { JsonDate } from "../../types.js";

export enum GithubDocumentStatus {
  PROCESSING = "processing",
  FAILED = "failed",
  PR_OPENED = "pr_opened",
  PR_MERGED = "pr_merged",
  PR_CLOSED = "pr_closed",
}

export enum GithubDocumentType {
  API_DOCUMENT = "api_document",
  ARCHITECTURE_DOCUMENT = "architecture_document",
}

export type GithubDocument = {
  id: string;
  team_id: string;
  github_repo_id: string;
  pull_request_number: number | null;
  status: GithubDocumentStatus;
  status_updated: JsonDate;
  file_path: string | null;
  api_name: string | null;
  type: GithubDocumentType;
};

export type GithubDocumentsQueryInput = {
  id?: string;
  github_repo_id?: string;
  type?: GithubDocumentType;
  pull_request_number?: number;
  // TODO: Validation
};

export type GithubDocumentCreateInput = {
  type: GithubDocumentType;
  status?: GithubDocumentStatus;
  file_path: string | null;
  api_name: string | null;
  pull_request_number: number | null;
};

export type GithubDocumentValuesInput = {
  pull_request_number?: number;
  status?: GithubDocumentStatus;
  file_path?: string;
  api_name?: string;
};

export type GithubDocumentUpdateInput = {
  id: string;
  new_values: GithubDocumentValuesInput;
};

export type GithubDocumentsDeleteByIdsInput = {
  id: string;
};

export type GithubDocumentsDeleteByTypeInput = {
  type: GithubDocumentType;
};
