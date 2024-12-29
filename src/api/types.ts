export interface Workspace {
  id: number;
  name: string;
}

export interface Client {
  id: number;
  wid: number;
  name: string;
  at: string;
  archived: boolean;
}

export interface Project {
  id: number;
  name: string;
  client_id: number;
}

export type TimeEntry = {
  id: number;
  workspace_id: number;
  project_id?: number;
  description: string;
  start: string;
  stop?: string;
  duration: number;
  start_timestamp: number;
  // Added fields for enriched data
  project?: Project;
  client?: Client;
};
