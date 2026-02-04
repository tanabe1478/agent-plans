# Plan Metadata Hook

A Claude Code PostToolUse hook that automatically injects YAML frontmatter metadata into plan files.

## What It Does

When Claude Code writes or edits a file in `~/.claude/plans/`, this hook automatically:

1. Detects if the file is a Markdown plan file
2. Parses existing frontmatter (if any)
3. Injects or updates metadata fields
4. Preserves the `created` timestamp and `status` field

## Metadata Fields

| Field | Behavior | Description |
|-------|----------|-------------|
| `created` | Preserved | Set only on first creation |
| `modified` | Overwritten | Updated on every change |
| `project_path` | Overwritten | Current working directory |
| `session_id` | Overwritten | Claude Code session ID |
| `status` | Preserved | `todo`, `in_progress`, or `completed` |

## Installation

### 1. Copy the script

```bash
mkdir -p ~/.claude/hooks
cp hooks/plan-metadata/inject.py ~/.claude/hooks/plan-metadata-inject.py
chmod +x ~/.claude/hooks/plan-metadata-inject.py
```

### 2. Configure Claude Code

Add to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/plan-metadata-inject.py"
          }
        ]
      }
    ]
  }
}
```

### 3. Restart Claude Code

The hook will take effect after restarting Claude Code.

## How It Works

The hook receives JSON input from Claude Code via stdin:

```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/Users/you/.claude/plans/my-plan.md"
  },
  "session_id": "abc123",
  "cwd": "/Users/you/projects/myapp"
}
```

The hook:
1. Checks if `tool_name` is `Write` or `Edit`
2. Checks if `file_path` is in `~/.claude/plans/`
3. Checks if the file is a `.md` file
4. If all conditions pass, injects/updates the frontmatter

## Example

Before:
```markdown
# My Plan

## Overview
This is my plan.
```

After:
```markdown
---
created: "2025-02-05T10:30:00Z"
modified: "2025-02-05T10:30:00Z"
project_path: "/Users/you/projects/myapp"
session_id: "abc123xyz"
status: todo
---
# My Plan

## Overview
This is my plan.
```

## Troubleshooting

### Hook not running

1. Check Claude Code logs for errors
2. Verify the script is executable: `chmod +x ~/.claude/hooks/plan-metadata-inject.py`
3. Restart Claude Code after changing settings.json

### Frontmatter not appearing

1. Ensure the file is in `~/.claude/plans/`
2. Ensure the file has `.md` extension
3. Check stderr output from the hook script
