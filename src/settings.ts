import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Settings } from './types.js';

export class SettingsManager {
  private configDir: string;
  private settingsFile: string;
  private settings: Settings;

  constructor() {
    this.configDir = join(
      process.platform === 'win32'
        ? process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
        : join(homedir(), '.config'),
      'toggl_client'
    );

    this.settingsFile = join(this.configDir, 'settings.json');
    this.ensureConfigDirExists();
    this.settings = this.loadSettings();
  }

  private ensureConfigDirExists(): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }
  }

  private getDefaultSettings(): Settings {
    return {
      default_workspace_id: null,
      recent_projects: [],
      recent_clients: [],
    };
  }

  private loadSettings(): Settings {
    try {
      if (existsSync(this.settingsFile)) {
        const content = readFileSync(this.settingsFile, 'utf-8').trim();
        if (content) {
          return JSON.parse(content);
        }
      }
      const defaultSettings = this.getDefaultSettings();
      this.saveSettings(defaultSettings);
      return defaultSettings;
    } catch (error) {
      const defaultSettings = this.getDefaultSettings();
      this.saveSettings(defaultSettings);
      return defaultSettings;
    }
  }

  private saveSettings(settings: Settings): void {
    writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2));
  }

  getDefaultWorkspace(): number | null {
    return this.settings.default_workspace_id;
  }

  setDefaultWorkspace(workspaceId: number): void {
    this.settings.default_workspace_id = workspaceId;
    this.saveSettings(this.settings);
  }

  addRecentProject(workspaceId: number, projectId: number): void {
    const recent = this.settings.recent_projects.filter(([_, p]) => p !== projectId);
    recent.unshift([workspaceId, projectId]);
    this.settings.recent_projects = recent.slice(0, 10);
    this.saveSettings(this.settings);
  }

  addRecentClient(workspaceId: number, clientId: number): void {
    const recent = this.settings.recent_clients.filter(([_, c]) => c !== clientId);
    recent.unshift([workspaceId, clientId]);
    this.settings.recent_clients = recent.slice(0, 10);
    this.saveSettings(this.settings);
  }

  getRecentProjects(workspaceId: number): number[] {
    return this.settings.recent_projects.filter(([w]) => w === workspaceId).map(([_, p]) => p);
  }

  getRecentClients(workspaceId: number): number[] {
    return this.settings.recent_clients.filter(([w]) => w === workspaceId).map(([_, c]) => c);
  }
}
