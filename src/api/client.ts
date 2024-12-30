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
    const entries = await this.request<TimeEntry[]>('/me/time_entries');
    if (projectId) {
      return entries.filter((entry) => entry.project_id === projectId);
    }
    return entries;
  }

  async getRecentTimeEntriesWithDetails(
    workspaceId: number,
    limit: number = 10
  ): Promise<TimeEntry[]> {
    // Get entries from the last month
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    const entries = await this.request<TimeEntry[]>(`/me/time_entries`);

    // Filter entries by workspace and date
    const filteredEntries = entries.filter((entry) => {
      const entryDate = new Date(entry.start);
      return entry.workspace_id === workspaceId && entryDate >= startDate && entryDate <= endDate;
    });

    // Get all unique project IDs from entries
    const projectIds = new Set(
      filteredEntries.filter((e) => e.project_id).map((e) => e.project_id)
    );

    // Fetch all projects in one go
    const projects = await this.getProjects(workspaceId);

    // Get all unique client IDs from projects
    const clientIds = new Set(projects.filter((p) => p.client_id).map((p) => p.client_id));

    // Fetch all clients in one go
    const clients = await this.getClients(workspaceId);

    // Create lookup maps
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const clientMap = new Map(clients.map((c) => [c.id, c]));

    // Sort entries by start date (newest first) and take the first 'limit' entries
    const sortedEntries = filteredEntries
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
      .slice(0, limit);

    // Enrich entries with project and client details
    return sortedEntries.map((entry) => ({
      ...entry,
      project: entry.project_id ? projectMap.get(entry.project_id) : undefined,
      client: entry.project_id
        ? clientMap.get(projectMap.get(entry.project_id)?.client_id || 0)
        : undefined,
    }));
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
