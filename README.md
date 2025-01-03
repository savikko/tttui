# Toggl Track TUI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A terminal user interface for Toggl Track, allowing you to manage your time entries directly from the command line.

Reason for this project is that I wanted to change client / project fast from command line. Seems that other tools did not support this.

This is inspired by [togglCli](https://github.com/AuHau/toggl-cli) but written in TypeScript and added some features:
- Finding clients and projects by name
- Easy way to add new clients and projects
- Listing recent time entries

Supports also multiple (Toggl Track) workspaces, but if you have only one workspace, it will use that one without asking.

[![asciicast](https://asciinema.org/a/f0YEagkHr4IfPBR4AcNQbSN0Y.svg)](https://asciinema.org/a/f0YEagkHr4IfPBR4AcNQbSN0Y)

## Installation

Easiest way to install this is to install with npm:
```bash
npm install -g @savikko/tttui
```

Then, you can use `tttui` or `t` to start the tool.

### Using pre-built executables

If you have no Node.js installed, you can use the pre-built executables.

Executables are built with `pkg`. Tried also Node.JS SEA but couldn't get it to work.

1. Download the appropriate executable for your system from the [latest release](../../releases/latest)
2. Rename it to `tttui` (or `tttui.exe` on Windows)
3. Make it executable (on Unix systems): `chmod +x tttui`
4. Move it to a directory in your PATH

### Building from source

```bash
# Clone the repository
git clone https://github.com/savikko/tttui.git
cd tttui

# Install dependencies
yarn install
```

## Development

```bash
# Run in development mode
yarn dev
```

## Building and compiling as binaries

```bash
# Create executables for all platforms
yarn package
```

This will create executables in the `bin` directory:
- `tttui-macos-arm64` (Apple Silicon)
- `tttui-macos-x64` (Intel Mac)
- `tttui-linux-x64`
- `tttui-win-x64.exe`

### Installing Globally

To use `tttui` from anywhere, copy the appropriate binary to your local bin directory:

```bash
# macOS/Linux (choose the right binary for your system)
sudo cp bin/tttui-macos-arm64 /usr/local/bin/tttui
sudo chmod +x /usr/local/bin/tttui

# Or without sudo (create ~/bin if it doesn't exist)
mkdir -p ~/bin
cp bin/tttui-macos-arm64 ~/bin/tttui
chmod +x ~/bin/tttui
# Add to your ~/.zshrc or ~/.bashrc if ~/bin is not in PATH:
# export PATH="$HOME/bin:$PATH"

# Optional: Add shorter alias (add to ~/.zshrc or ~/.bashrc)
alias t=tttui
```

Now you can run `tttui` (or just `t`) from anywhere!

## Usage

### Starting a Time Entry

```bash
# Interactive mode (default)
tttui  # or just 't'
```

This will:
1. Ask for your Toggl API token (first time only)
2. Show any running time entry
3. Let you select workspace (if you have multiple workspaces), client, and project
4. Start a new time entry

### Stopping Current Time Entry

```bash
tttui stop  # or 't stop'
```

Also, when running `tttui` and you have a running time entry, it will stop the previous time entry and start a new one.

### Listing Time Entries

```bash
tttui list  # or 't list'
```

This will show recent time entries grouped by day, showing for each entry:
   - Duration in hours and minutes (e.g., "01h30m")
   - Time range [HH:MM-HH:MM]
   - Description
   - Client and project information
   - Status (🟢 for running, ⚫ for completed)

### Editing Time Entries

```bash
tttui edit  # or 't edit'
```

This command allows you to edit recent time entries:
1. Shows a list of your 10 most recent time entries
2. Select an entry to edit
3. Edit the start time, end time, and description

Example output:
```
Recent entries:

2024-03-21:
----------------
⚫ 00h45m [09:15-10:00] Task 1 (Client - Project)
⚫ 01h15m [10:30-11:45] Task 2 (Client - Project)
```

## Environment Variables

For me, the use case is that I am utilizing [direnv](https://direnv.net/) to manage my environment variables.

### TOGGL_API_TOKEN

You can set your API token using the `TOGGL_API_TOKEN` environment variable:

```bash
export TOGGL_API_TOKEN=your_api_token_here
```

When this is set, the tool will:
- Use this token instead of reading from the config file
- Skip the API token prompt on first run
- Allow running the tool without any stored configuration

### TOGGL_PROJECT

You can set a default project using the `TOGGL_PROJECT` environment variable:

```bash
export TOGGL_PROJECT=123456789  # Replace with your project ID
```

When this is set, the tool will:
- Skip client and project selection
- Use the specified project directly
- Show which project and client it's using
- Proceed straight to task description

If there's any error with the predefined project (not found, wrong ID, etc.), the tool will fall back to the normal selection flow.

### TOGGL_CLIENT

You can set a default client using the `TOGGL_CLIENT` environment variable:

```bash
export TOGGL_CLIENT=123456789  # Replace with your client ID
```

When this is set, the tool will:
- Skip client selection
- Use the specified client directly
- Show which client it's using
- Continue with project selection

If there's any error with the predefined client (not found, wrong ID, etc.), the tool will fall back to the normal client selection.

Note, if there is no client, just use `TOGGL_CLIENT=0`.

## Configuration

The app stores its configuration in `~/.tttui` (as a JSON file), including:
- Your Toggl API token
- Recently used workspaces, clients, and projects

## API Token

You can find your Toggl API token at:
https://track.toggl.com/profile (scroll down to find your API token) 