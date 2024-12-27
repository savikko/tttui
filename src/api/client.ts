import { API_BASE_URL } from './constants';
import { Workspace, Client, Project, TimeEntry } from './types';

export class TogglClient {
  private baseUrl = API_BASE_URL;
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: any;
    } = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method || 'GET',
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.token}:api_token`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, body: ${await response.text()}`);
    }

    return response.json();
  }

  async getWorkspaces(): Promise<Workspace[]> {
    return this.request<Workspace[]>('/workspaces');
  }

  async getClients(workspaceId: number): Promise<Client[]> {
    return this.request<Client[]>(`/workspaces/${workspaceId}/clients`);
  }

  async createClient(workspaceId: number, name: string): Promise<Client> {
    return this.request<Client>(`/workspaces/${workspaceId}/clients`, {
      method: 'POST',
      body: { name },
    });
  }

  async getProjects(workspaceId: number): Promise<Project[]> {
    return this.request<Project[]>(`/workspaces/${workspaceId}/projects`);
  }

  async createProject(workspaceId: number, name: string, clientId: number): Promise<Project> {
    return this.request<Project>(`/workspaces/${workspaceId}/projects`, {
      method: 'POST',
      body: {
        name,
        client_id: clientId,
        active: true,
        is_private: false,
      },
    });
  }

  async getProjectsByClient(workspaceId: number, clientId: number): Promise<Project[]> {
    const projects = await this.getProjects(workspaceId);
    return projects.filter((project) => project.client_id === clientId);
  }

  async getProjectDetails(
    workspaceId: number,
    projectId: number
  ): Promise<{ project: Project; client: Client | null }> {
    const projects = await this.getProjects(workspaceId);
    const project = projects.find((p) => p.id === projectId);

    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    if (project.client_id) {
      const clients = await this.getClients(workspaceId);
      const client = clients.find((c) => c.id === project.client_id);
      return { project, client: client || null };
    }

    return { project, client: null };
  }

  async getCurrentTimeEntry(): Promise<TimeEntry | null> {
    try {
      return await this.request<TimeEntry>('/me/time_entries/current');
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async startTimeEntry(timeEntry: {
    description: string;
    workspaceId: number;
    projectId: number;
    billable?: boolean;
  }): Promise<TimeEntry> {
    return this.request<TimeEntry>(`/workspaces/${timeEntry.workspaceId}/time_entries`, {
      method: 'POST',
      body: {
        created_with: 'toggl-cli',
        description: timeEntry.description,
        project_id: timeEntry.projectId,
        billable: timeEntry.billable,
        start: new Date().toISOString(),
        duration: -1, // Running time entry
        wid: timeEntry.workspaceId,
      },
    });
  }

  async stopTimeEntry(workspaceId: number, timeEntryId: number): Promise<TimeEntry> {
    return this.request<TimeEntry>(`/workspaces/${workspaceId}/time_entries/${timeEntryId}/stop`, {
      method: 'PATCH',
    });
  }

  async updateTimeEntryDescription(
    workspaceId: number,
    timeEntryId: number,
    description: string
  ): Promise<TimeEntry> {
    return this.request<TimeEntry>(`/workspaces/${workspaceId}/time_entries/${timeEntryId}`, {
      method: 'PUT',
      body: {
        description,
      },
    });
  }

  async getRecentTimeEntries(workspaceId: number, projectId?: number): Promise<TimeEntry[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3); // Get entries from last 3 months

    const entries = await this.request<TimeEntry[]>('/me/time_entries');
    const recentEntries = entries.filter((entry) => {
      const entryDate = new Date(entry.start);
      return entryDate >= startDate && entry.workspace_id === workspaceId;
    });

    if (projectId) {
      return recentEntries.filter((entry) => entry.project_id === projectId);
    }
    return recentEntries;
  }

  async getClientDetails(workspaceId: number, clientId: number): Promise<Client> {
    const clients = await this.getClients(workspaceId);
    const client = clients.find((c) => c.id === clientId);

    if (!client) {
      throw new Error(`Client with ID ${clientId} not found`);
    }

    return client;
  }
}
