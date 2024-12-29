#!/usr/bin/env node

// Suppress experimental warnings
process.removeAllListeners('warning');

import { select, input, search } from '@inquirer/prompts';
import inputWithValue from './prompts/inputWithValue';
import { Command } from 'commander';
import { TogglClient } from './api/client';
import { getApiToken, setApiToken, getLastSelected, setLastSelected } from './config';
import { Workspace, Client, Project, TimeEntry } from './api/types';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const program = new Command();

// Read version from package.json
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const version = packageJson.version;

program
  .name('tttui')
  .description('tttui - A terminal user interface for Toggl Track')
  .version(version, '-v, --version', 'Show the current version');

program
  .command('stop')
  .description('Stop the currently running time entry')
  .action(async () => {
    try {
      const token = await ensureApiToken();
      const client = new TogglClient(token);

      const currentEntry = await client.getCurrentTimeEntry();
      if (!currentEntry || !currentEntry.id) {
        console.log('No running time entry found.');
        process.exit(0);
      }

      // Get project details if available
      let projectInfo = '';
      if (currentEntry.project_id) {
        const projects = await client.getProjects(currentEntry.workspace_id);
        const project = projects.find((p) => p.id === currentEntry.project_id);
        if (project) {
          const clients = await client.getClients(currentEntry.workspace_id);
          const projectClient = clients.find((c) => c.id === project.client_id);
          projectInfo = ` (${projectClient?.name || 'No client'} - ${project.name})`;
        }
      }

      console.log(`Stopping time entry "${currentEntry.description}"${projectInfo}...`);
      const stoppedEntry = await client.stopTimeEntry(currentEntry.workspace_id, currentEntry.id);
      console.log(
        `Stopped time entry "${stoppedEntry.description}" (duration: ${Math.abs(Math.floor(stoppedEntry.duration / 60))} minutes)`
      );
    } catch (error) {
      console.error('An error occurred:', error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List recent time entries')
  .action(async () => {
    try {
      const token = await ensureApiToken();
      const client = new TogglClient(token);
      const currentEntry = await client.getCurrentTimeEntry();

      // Get the workspace ID from current entry or select workspace
      const workspace = currentEntry
        ? { id: currentEntry.workspace_id }
        : await selectWorkspace(client);

      const entries = await client.getRecentTimeEntriesWithDetails(workspace.id);

      // Format duration helper function
      const formatDuration = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}h${mins.toString().padStart(2, '0')}m`;
      };

      // Format time range helper function
      const formatTimeRange = (start: string, stop?: string): string => {
        const startTime = new Date(start);
        const stopTime = stop ? new Date(stop) : new Date();
        const formatTime = (date: Date) =>
          `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        return `[${formatTime(startTime)}-${formatTime(stopTime)}]`;
      };

      // Show current entry first if exists
      if (currentEntry) {
        const duration = Math.floor((Date.now() / 1000 - currentEntry.start_timestamp) / 60);
        console.log('\nCurrently running:');
        console.log(
          `🟢 ${formatDuration(duration)} ${formatTimeRange(currentEntry.start)} ${currentEntry.description} ${
            currentEntry.project?.name
              ? `(${currentEntry.client?.name || 'No client'} - ${currentEntry.project.name})`
              : ''
          }`
        );
      }

      // Group entries by day
      const entriesByDay = new Map<string, TimeEntry[]>();
      entries.forEach((entry) => {
        const date = new Date(entry.start);
        const dateKey = date.toISOString().split('T')[0];
        if (!entriesByDay.has(dateKey)) {
          entriesByDay.set(dateKey, []);
        }
        entriesByDay.get(dateKey)?.push(entry);
      });

      // Show entries grouped by day
      console.log('\nRecent entries:');
      Array.from(entriesByDay.entries())
        .sort((a, b) => b[0].localeCompare(a[0])) // Sort days newest first
        .forEach(([date, dayEntries]) => {
          console.log(`\n${date}:`);
          console.log('----------------');
          dayEntries.forEach((entry) => {
            const duration = Math.abs(Math.floor(entry.duration / 60));
            const projectInfo = entry.project?.name
              ? ` (${entry.client?.name || 'No client'} - ${entry.project.name})`
              : '';
            console.log(
              `${entry.stop ? '⚫' : '🟢'} ${formatDuration(duration)} ${formatTimeRange(entry.start, entry.stop)} ${entry.description}${projectInfo}`
            );
          });
        });
    } catch (error) {
      console.error('An error occurred:', error);
      process.exit(1);
    }
  });

// Default command (no arguments) - start a new time entry
program.action(async () => {
  await main();
});

// Parse command line arguments
program.parse();

async function ensureApiToken(): Promise<string> {
  // Check environment variable first
  const envToken = process.env.TOGGL_API_TOKEN;
  if (envToken) {
    return envToken;
  }

  // Then check stored token
  const token = getApiToken();
  if (token) {
    return token;
  }

  console.log('Welcome to tttui!');
  console.log('Please enter your Toggl API token to get started.');
  console.log('You can find your API token at: https://track.toggl.com/profile');

  const newToken = await input({
    message: 'Enter your Toggl API token:',
    validate: (value) => {
      if (!value) return 'API token is required';
      return true;
    },
  });

  setApiToken(newToken);
  return newToken;
}

async function selectWorkspace(client: TogglClient): Promise<Workspace> {
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

  // If there's a last selected workspace, move it to the top
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

async function selectClient(client: TogglClient, workspaceId: number): Promise<Client> {
  const clients = (await client.getClients(workspaceId)) || [];
  const lastSelected = getLastSelected();

  // Remove last selected from the list if it exists
  let lastSelectedClient: Client | undefined;
  if (lastSelected.clientId && clients.length > 0) {
    const lastIndex = clients.findIndex((c) => c.id === lastSelected.clientId);
    if (lastIndex !== -1) {
      [lastSelectedClient] = clients.splice(lastIndex, 1);
    }
  }

  const choices = [
    ...(lastSelectedClient
      ? [
          {
            name: `${lastSelectedClient.name} (${lastSelectedClient.id}) (last used)`,
            value: lastSelectedClient,
          },
        ]
      : []),
    {
      name: 'No client',
      value: { id: 0, name: 'No client' } as Client,
    },
    ...clients.map((c) => ({
      name: `${c.name} (${c.id})`,
      value: c,
    })),
  ];

  const selectedClient = await search<Client>({
    message:
      clients.length > 0
        ? 'Select client (type to search, Enter to create new):'
        : 'No clients found. Select "No client" or create new:',
    source: (term) => {
      if (!term) return choices;

      const searchTerm = term.toLowerCase();
      const filtered = choices.filter((c) => c.name.toLowerCase().includes(searchTerm));

      if (filtered.length === 0) {
        return [
          {
            name: `Create new client "${term}"`,
            value: { id: -1, name: term } as Client,
          },
        ];
      }

      return filtered;
    },
    pageSize: 10,
  });

  if (selectedClient.id === -1) {
    if (!selectedClient.name) {
      const name = await input({
        message: 'Enter new client name:',
        validate: (value) => {
          if (!value) return 'Client name is required';
          return true;
        },
      });
      selectedClient.name = name;
    }

    const newClient = await client.createClient(workspaceId, selectedClient.name);
    setLastSelected({ clientId: newClient.id });
    return newClient;
  }

  if (selectedClient.id !== 0) {
    setLastSelected({ clientId: selectedClient.id });
  }
  return selectedClient;
}

async function selectProject(
  client: TogglClient,
  workspaceId: number,
  clientId: number
): Promise<Project> {
  // If no client is selected, get all projects
  const projects =
    clientId === 0
      ? await client.getProjects(workspaceId)
      : await client.getProjectsByClient(workspaceId, clientId);
  const lastSelected = getLastSelected();

  // Remove last selected from the list if it exists
  let lastSelectedProject: Project | undefined;
  if (lastSelected.projectId) {
    const lastIndex = projects.findIndex((p) => p.id === lastSelected.projectId);
    if (lastIndex !== -1) {
      [lastSelectedProject] = projects.splice(lastIndex, 1);
    }
  }

  const choices = [
    ...(lastSelectedProject
      ? [
          {
            name: `${lastSelectedProject.name} (${lastSelectedProject.id}) (last used)`,
            value: lastSelectedProject,
          },
        ]
      : []),
    ...projects.map((p) => ({
      name: `${p.name} (${p.id})`,
      value: p,
    })),
  ];

  const project = await search<Project>({
    message: 'Select project (type to search, Enter to create new):',
    source: (term) => {
      if (!term) return choices;

      const searchTerm = term.toLowerCase();
      const filtered = choices.filter((p) => p.name.toLowerCase().includes(searchTerm));

      if (filtered.length === 0) {
        return [
          {
            name: `Create new project "${term}"`,
            value: { id: -1, name: term } as Project,
          },
        ];
      }

      return filtered;
    },
    pageSize: 10,
  });

  if (project.id === -1) {
    if (!project.name) {
      const name = await input({
        message: 'Enter new project name:',
        validate: (value) => {
          if (!value) return 'Project name is required';
          return true;
        },
      });
      project.name = name;
    }

    const newProject = await client.createProject(workspaceId, project.name, clientId);
    setLastSelected({ projectId: newProject.id });
    return newProject;
  }

  setLastSelected({ projectId: project.id });
  return project;
}

async function getTaskDescription(
  client: TogglClient,
  workspace: Workspace,
  selectedClient: Client,
  selectedProject: Project
): Promise<string> {
  const recentEntries = await client.getRecentTimeEntries(workspace.id, selectedProject.id);
  const uniqueDescriptions = Array.from(
    new Set(recentEntries.map((entry) => entry.description))
  ).filter(Boolean);

  const description = await search<string>({
    message:
      uniqueDescriptions.length > 0
        ? 'Select or enter task description:'
        : 'Enter task description:',
    source: (term) => {
      if (!term)
        return uniqueDescriptions.map((desc) => ({
          name: desc,
          value: desc,
        }));

      const searchTerm = term.toLowerCase();
      const filtered = uniqueDescriptions
        .filter((desc) => desc.toLowerCase().includes(searchTerm))
        .map((desc) => ({
          name: desc,
          value: desc,
        }));

      if (filtered.length === 0 || term.length > 0) {
        return [
          {
            name: `Create "${term}"`,
            value: term,
          },
        ];
      }

      return filtered;
    },
  });

  return description || `${selectedClient.name} - ${selectedProject.name}`;
}

async function main() {
  try {
    const token = await ensureApiToken();
    const client = new TogglClient(token);
    const currentEntry = await client.getCurrentTimeEntry();

    if (currentEntry) {
      // Get project details if available
      let projectInfo = '';
      if (currentEntry.project_id) {
        const projects = await client.getProjects(currentEntry.workspace_id);
        const project = projects.find((p) => p.id === currentEntry.project_id);
        if (project) {
          const clients = await client.getClients(currentEntry.workspace_id);
          const projectClient = clients.find((c) => c.id === project.client_id);
          projectInfo = ` (${projectClient?.name || 'No client'} - ${project.name})`;
        }
      }

      const shouldStop = await select({
        message: `Found running time entry "${currentEntry.description}"${projectInfo}. What would you like to do?`,
        choices: [
          { name: 'New time entry (stop current)', value: 'new' },
          { name: 'Change description', value: 'change' },
          { name: 'Stop it', value: 'stop' },
        ],
      });

      if (shouldStop === 'stop') {
        const stoppedEntry = await client.stopTimeEntry(currentEntry.workspace_id, currentEntry.id);
        console.log(
          `Stopped time entry "${stoppedEntry.description}" (duration: ${Math.abs(
            Math.floor(stoppedEntry.duration / 60)
          )} minutes)`
        );
        process.exit(0);
      }

      if (shouldStop === 'change') {
        const newDescription = await inputWithValue({
          message: 'Edit description:',
          value: currentEntry.description,
        });

        if (newDescription !== currentEntry.description) {
          const updatedEntry = await client.updateTimeEntryDescription(
            currentEntry.workspace_id,
            currentEntry.id,
            newDescription
          );

          console.log(`Updated time entry description to: "${updatedEntry.description}"`);
        }
        process.exit(0);
      }
    }

    const workspace = await selectWorkspace(client);

    // Check for predefined project or client
    const predefinedProjectId = process.env.TOGGL_PROJECT;
    const predefinedClientId = process.env.TOGGL_CLIENT;

    if (predefinedProjectId) {
      try {
        const projectId = parseInt(predefinedProjectId, 10);
        if (isNaN(projectId)) {
          throw new Error('Invalid project ID format');
        }
        const { project, client: projectClient } = await client.getProjectDetails(
          workspace.id,
          projectId
        );
        console.log(
          `Using project ${project.name} (${project.id}) client: ${projectClient?.name || 'No client'}`
        );

        const description = await getTaskDescription(
          client,
          workspace,
          projectClient || ({ id: -1, name: 'No client' } as Client),
          project
        );
        const timeEntry = await client.startTimeEntry({
          description,
          workspaceId: workspace.id,
          projectId: project.id,
        });

        console.log(`Started time entry for ${timeEntry.description}`);
        return;
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Could not use project ${predefinedProjectId}: ${error.message}`);
        } else {
          console.error(`Could not use project ${predefinedProjectId}`);
        }
        console.log('Falling back to normal selection...\n');
      }
    }

    // Try using predefined client
    let selectedClient: Client;
    if (predefinedClientId) {
      try {
        const clientId = parseInt(predefinedClientId, 10);
        if (isNaN(clientId)) {
          throw new Error('Invalid client ID format');
        }
        if (clientId === 0) {
          selectedClient = { id: 0, name: 'No client' } as Client;
          console.log('Using no client');
        } else {
          const clients = await client.getClients(workspace.id);
          if (!clients || clients.length === 0) {
            throw new Error('No clients found in workspace');
          }
          selectedClient = await client.getClientDetails(workspace.id, clientId);
          console.log(`Using client ${selectedClient.name} (${selectedClient.id})`);
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Could not use client ${predefinedClientId}: ${error.message}`);
        } else {
          console.error(`Could not use client ${predefinedClientId}`);
        }
        console.log('Falling back to normal selection...\n');
        selectedClient = await selectClient(client, workspace.id);
      }
    } else {
      selectedClient = await selectClient(client, workspace.id);
    }

    const project = await selectProject(client, workspace.id, selectedClient.id);
    const description = await getTaskDescription(client, workspace, selectedClient, project);

    const timeEntry = await client.startTimeEntry({
      description,
      workspaceId: workspace.id,
      projectId: project.id,
    });

    console.log(`Started time entry for ${timeEntry.description}`);
  } catch (error) {
    // Handle Ctrl+C gracefully
    if (error instanceof Error && error.message.includes('User force closed the prompt')) {
      process.exit(0);
    }
    console.error('An error occurred:', error);
    process.exit(1);
  }
}
