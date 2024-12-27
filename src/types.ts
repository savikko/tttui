export interface Workspace {
  id: number;
  name: string;
}

export interface Client {
  id: number;
  name: string;
  wid: number; // workspace id
}

export interface Project {
  id: number;
  name: string;
  wid: number; // workspace id
  cid?: number; // client id
  active: boolean;
}

export interface TimeEntry {
  id?: number;
  description: string;
  pid: number; // project id
  start: string; // ISO date string
  stop?: string; // ISO date string
  duration: number;
  created_with: string;
}

export interface Settings {
  default_workspace_id: number | null;
  recent_projects: [number, number][]; // Array of [workspace_id, project_id]
  recent_clients: [number, number][]; // Array of [workspace_id, client_id]
}
