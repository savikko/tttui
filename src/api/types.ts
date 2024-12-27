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

export interface TimeEntry {
  id: number;
  description: string;
  workspace_id: number;
  project_id?: number;
  duration: number;
  start: string;
}
