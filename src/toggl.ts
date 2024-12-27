import { config } from 'dotenv';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Workspace, Client, Project, TimeEntry } from './types.js';

config();

export class TogglClient {
  private apiToken: string;
  private baseUrl = 'https://api.track.toggl.com/api/v9';
  private configDir: string;
  private configFile: string;

  constructor() {
    this.configDir = join(
      process.platform === 'win32'
        ? process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
        : join(homedir(), '.config'),
      'toggl_client'
    );

    this.configFile = join(this.configDir, 'config.env');
    this.ensureConfigExists();
    this.apiToken = this.loadApiToken();
  }

  private ensureConfigExists(): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    if (!existsSync(this.configFile)) {
      writeFileSync(
        this.configFile,
        '# You can get your API token from https://track.toggl.com/profile (scroll down and click reveal)\n' +
          'TOGGL_API_TOKEN=your_api_token_here\n'
      );
    }
  }

  private loadApiToken(): string {
    config({ path: this.configFile });
    const token = process.env.TOGGL_API_TOKEN;

    if (!token || token === 'your_api_token_here') {
      const newToken = this.askForToken();
      this.saveToken(newToken);
      return newToken;
    }

    return token;
  }

  private askForToken(): string {
    console.log('\nToggl API token not found or not set.');
    console.log('You can get your API token from https://track.toggl.com/profile');
    console.log('1. Log in to your Toggl account');
    console.log('2. Go to Profile Settings');
    console.log("3. Scroll down and click 'reveal' to see your API token");
    console.log('\nPlease enter your Toggl API token:');

    const token = prompt('> ');
    if (!token) {
      console.error('API token cannot be empty.');
      process.exit(1);
    }

    return token;
  }

  private saveToken(token: string): void {
    writeFileSync(
      this.configFile,
      '# You can get your API token from https://track.toggl.com/profile (scroll down and click reveal)\n' +
        `TOGGL_API_TOKEN=${token}\n`
    );
    console.log(`\nAPI token saved to ${this.configFile}`);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${this.apiToken}:api_token`).toString('base64')}`,
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getWorkspaces(): Promise<Workspace[]> {
    return this.request<Workspace[]>('/workspaces');
  }

  async getClients(workspaceId: number): Promise<Client[]> {
    return this.request<Client[]>(`/workspaces/${workspaceId}/clients`);
  }

  async getProjects(workspaceId: number): Promise<Project[]> {
    return this.request<Project[]>(`/workspaces/${workspaceId}/projects`);
  }

  async getTimeEntries(): Promise<TimeEntry[]> {
    return this.request<TimeEntry[]>('/me/time_entries');
  }

  async startTimeEntry(description: string, projectId: number): Promise<TimeEntry> {
    const entry: Partial<TimeEntry> = {
      description,
      pid: projectId,
      start: new Date().toISOString(),
      created_with: 'toggl_client',
    };

    return this.request<TimeEntry>('/time_entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async stopCurrentTimer(): Promise<TimeEntry | null> {
    const current = await this.request<TimeEntry | null>('/me/time_entries/current');
    if (!current) return null;

    return this.request<TimeEntry>(`/time_entries/${current.id}/stop`, {
      method: 'PATCH',
    });
  }
}
