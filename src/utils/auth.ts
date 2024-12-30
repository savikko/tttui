import { input, search } from '@inquirer/prompts';
import { TogglClient } from '../api/client';
import { Workspace } from '../api/types';
import { getApiToken, setApiToken, getLastSelected, setLastSelected } from '../config';

export async function ensureApiToken(): Promise<string> {
  const envToken = process.env.TOGGL_API_TOKEN;
  if (envToken) return envToken;

  const token = getApiToken();
  if (token) return token;

  const newToken = await input({
    message: 'Enter your Toggl API token:',
    validate: (value) => (value ? true : 'API token is required'),
  });

  setApiToken(newToken);
  return newToken;
}

export async function selectWorkspace(client: TogglClient): Promise<Workspace> {
  const workspaces = await client.getWorkspaces();
  const lastSelected = getLastSelected();

  if (workspaces.length === 0) {
    console.error('No workspaces found');
    process.exit(1);
  }

  if (workspaces.length === 1) {
    setLastSelected({ workspaceId: workspaces[0].id });
    return workspaces[0];
  }

  if (lastSelected.workspaceId) {
    const lastIndex = workspaces.findIndex((w) => w.id === lastSelected.workspaceId);
    if (lastIndex !== -1) {
      const [lastWorkspace] = workspaces.splice(lastIndex, 1);
      workspaces.unshift(lastWorkspace);
    }
  }

  const workspace = await search<Workspace>({
    message: 'Select workspace:',
    source: (term) => {
      if (!term)
        return workspaces.map((ws) => ({
          name: ws.name || 'Unnamed workspace',
          value: ws,
        }));

      const searchTerm = term.toLowerCase();
      return workspaces
        .filter((ws) => (ws.name || '').toLowerCase().includes(searchTerm))
        .map((ws) => ({
          name: ws.name || 'Unnamed workspace',
          value: ws,
        }));
    },
    pageSize: 10,
  });

  setLastSelected({ workspaceId: workspace.id });
  return workspace;
}
