export enum DocumentPlatform {
  eave = "eave",
  confluence = "confluence",
  google_drive = "google_drive",
}

export type Team = {
  id: string;
  name: string;
  document_platform: DocumentPlatform | null;
};

export type TeamInput = {
  id: string;
};

export interface ConfluenceDestinationInput {
  space_key: string;
}

export type ConfluenceDestination = {
  id: string;
  space_key: string | null;
};

export type Destination = {
  confluence_destination?: ConfluenceDestination;
};
