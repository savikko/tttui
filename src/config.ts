import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_FILE = path.join(os.homedir(), '.tttui');

interface Config {
  apiToken?: string;
  lastWorkspaceId?: number;
  lastClientId?: number;
  lastProjectId?: number;
}

function readConfig(): Config {
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

function writeConfig(config: Config): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getApiToken(): string | undefined {
  return readConfig().apiToken;
}

export function setApiToken(token: string): void {
  const config = readConfig();
  config.apiToken = token;
  writeConfig(config);
}

export function getLastSelected(): {
  workspaceId?: number;
  clientId?: number;
  projectId?: number;
} {
  const config = readConfig();
  return {
    workspaceId: config.lastWorkspaceId,
    clientId: config.lastClientId,
    projectId: config.lastProjectId,
  };
}

export function setLastSelected(params: {
  workspaceId?: number;
  clientId?: number;
  projectId?: number;
}): void {
  const config = readConfig();
  if (params.workspaceId !== undefined) config.lastWorkspaceId = params.workspaceId;
  if (params.clientId !== undefined) config.lastClientId = params.clientId;
  if (params.projectId !== undefined) config.lastProjectId = params.projectId;
  writeConfig(config);
}
