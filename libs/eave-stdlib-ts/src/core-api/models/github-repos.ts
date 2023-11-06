import { UUID } from "../../types.js";

export enum GithubRepoFeature {
  API_DOCUMENTATION = "api_documentation",
  INLINE_CODE_DOCUMENTATION = "inline_code_documentation",
  ARCHITECTURE_DOCUMENTATION = "architecture_documentation",
}

export enum GithubRepoFeatureState {
  DISABLED = "disabled",
  ENABLED = "enabled",
  PAUSED = "paused",
}

export type GithubRepo = {
  team_id: UUID;
  id: UUID;
  github_installation_id: UUID;
  external_repo_id: string;
  display_name: string | null;
  api_documentation_state: GithubRepoFeatureState;
  inline_code_documentation_state: GithubRepoFeatureState;
  architecture_documentation_state: GithubRepoFeatureState;
};

export type GithubRepoCreateInput = {
  external_repo_id: string;
  display_name: string;
  api_documentation_state?: GithubRepoFeatureState;
  inline_code_documentation_state?: GithubRepoFeatureState;
  architecture_documentation_state?: GithubRepoFeatureState;
};

export type GithubRepoRefInput = {
  id: UUID;
};

export type GithubRepoListInput = {
  external_repo_id: string;
};

export type GithubRepoUpdateValues = {
  api_documentation_state?: GithubRepoFeatureState;
  inline_code_documentation_state?: GithubRepoFeatureState;
  architecture_documentation_state?: GithubRepoFeatureState;
};

export type GithubRepoUpdateInput = {
  id: UUID;
  new_values: GithubRepoUpdateValues;
};

export type GithubReposDeleteInput = {
  id: UUID;
};

export type GithubReposFeatureStateInput = {
  feature: GithubRepoFeature;
  state: GithubRepoFeatureState;
};
