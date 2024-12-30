import { search } from '@inquirer/prompts';
import { TogglClient } from '../api/client';
import { TimeEntry } from '../api/types';
import timeEntryEdit from '../prompts/timeEntryEdit';
import dayjs from 'dayjs';
import { ensureApiToken, selectWorkspace } from '../utils/auth';

const TIME_FORMAT = 'HH:mm YYYY-MM-DD';

export async function editCommand() {
  try {
    const token = await ensureApiToken();
    const client = new TogglClient(token);
    const workspace = await selectWorkspace(client);

    // Get recent time entries
    const entries = await client.getRecentTimeEntriesWithDetails(workspace.id, 10);

    // Format entries for selection
    const formattedEntries = entries.map((entry) => {
      const start = dayjs(entry.start);
      const stop = entry.stop ? dayjs(entry.stop) : dayjs();
      const duration = stop.diff(start, 'minutes');
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      const projectInfo = entry.project
        ? ` (${entry.client?.name || 'No client'} - ${entry.project.name})`
        : '';

      return {
        name: `${start.format('YYYY-MM-DD HH:mm')} - ${stop.format('HH:mm')} (${hours}h${minutes}m) ${entry.description}${projectInfo}`,
        value: entry,
      };
    });

    // Let user select an entry to edit
    const selectedEntry = await search<TimeEntry>({
      message: 'Select time entry to edit:',
      source: (term) => {
        if (!term) return formattedEntries;

        const searchTerm = term.toLowerCase();
        return formattedEntries.filter((entry) => entry.name.toLowerCase().includes(searchTerm));
      },
    });

    // Edit the selected entry
    const editResult = await timeEntryEdit({
      message: 'Edit time entry',
      startTime: dayjs(selectedEntry.start).format(TIME_FORMAT),
      endTime: selectedEntry.stop ? dayjs(selectedEntry.stop).format(TIME_FORMAT) : undefined,
      description: selectedEntry.description,
    });

    // Update the time entry
    const updatedEntry = await client.updateTimeEntry(
      selectedEntry.workspace_id,
      selectedEntry.id,
      {
        start: dayjs(editResult.startTime).toISOString(),
        stop: editResult.endTime ? dayjs(editResult.endTime).toISOString() : undefined,
        description: editResult.description,
      }
    );

    console.log(`Updated time entry: "${updatedEntry.description}"`);
  } catch (error) {
    // Handle Ctrl+C gracefully
    if (error instanceof Error && error.message.includes('User force closed the prompt')) {
      process.exit(0);
    }
    console.error('An error occurred:', error);
    process.exit(1);
  }
}
