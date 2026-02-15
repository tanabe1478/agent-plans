# Plan Metadata Hook

A PostToolUse hook that automatically injects YAML frontmatter metadata into plan files.

## What It Does

When a compatible coding agent writes or edits a Markdown plan, this hook:

1. Detects if the file belongs to a configured plan directory
2. Parses existing frontmatter (if any)
3. Injects or updates metadata fields
4. Preserves `status` if already present

## Supported Plan Directories

The hook targets files under these directories (in order):

1. `PLANS_DIR` (if set)
2. `~/.agent-plans/plans`
3. `~/.claude/plans` (legacy compatibility)

## Metadata Fields

| Field | Behavior | Description |
| --- | --- | --- |
| `project_path` | Overwritten | Current working directory |
| `session_id` | Overwritten | Current agent session ID |
| `status` | Preserved/defaulted | Existing value is kept, otherwise `todo` |

## Installation

### 1. Copy the script

```bash
mkdir -p ~/.agent-plans/hooks
cp hooks/plan-metadata/inject.py ~/.agent-plans/hooks/plan-metadata-inject.py
chmod +x ~/.agent-plans/hooks/plan-metadata-inject.py
```

### 2. Configure your agent hook

Example for Claude Code (`~/.claude/settings.json`):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "~/.agent-plans/hooks/plan-metadata-inject.py"
          }
        ]
      }
    ]
  }
}
```

### 3. Restart your agent session

Restart your coding-agent session after changing hook settings.

## How It Works

The hook receives JSON input via stdin:

```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/Users/you/.agent-plans/plans/my-plan.md"
  },
  "session_id": "abc123",
  "cwd": "/Users/you/projects/myapp"
}
```

The hook:
1. Checks if `tool_name` is `Write` or `Edit`
2. Checks if `file_path` is in a supported plan directory
3. Checks if the file is a `.md` file
4. Injects/updates frontmatter metadata

## Troubleshooting

### Hook not running

1. Check agent logs for errors
2. Verify the script is executable: `chmod +x ~/.agent-plans/hooks/plan-metadata-inject.py`
3. Restart your agent session after changing settings

### Frontmatter not appearing

1. Ensure the file is in `~/.agent-plans/plans` (or legacy `~/.claude/plans`)
2. Ensure the file has `.md` extension
3. Check stderr output from the hook script
