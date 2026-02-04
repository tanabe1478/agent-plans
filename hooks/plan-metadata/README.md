# Plan Metadata Injector Hook

A Claude Code hook that automatically injects YAML frontmatter metadata into plan files.

## Features

- Automatically adds metadata when plan files are created or modified
- Tracks creation time, modification time, project path, and session ID
- Supports status tracking: `todo`, `in_progress`, `completed`
- Preserves `created` timestamp and `status` on updates (overwrite strategy for other fields)

## Frontmatter Format

```yaml
---
created: 2025-02-05T10:30:00Z
modified: 2025-02-05T11:00:00Z
project_path: /Users/you/projects/myapp
session_id: abc123xyz
status: todo
---
```

### Fields

| Field | Description | Behavior on Update |
|-------|-------------|-------------------|
| `created` | Initial creation timestamp (UTC) | Preserved |
| `modified` | Last modification timestamp (UTC) | Updated |
| `project_path` | Working directory when plan was created/modified | Updated |
| `session_id` | Claude Code session identifier | Updated |
| `status` | Plan status: `todo`, `in_progress`, `completed` | Preserved |

## Installation

### 1. Copy the hook script

```bash
# Option A: Copy to ~/.claude/hooks/
mkdir -p ~/.claude/hooks
cp hooks/plan-metadata/inject.py ~/.claude/hooks/plan-metadata-inject.py

# Option B: Use directly from this repo
# Just reference the full path in settings
```

### 2. Configure Claude Code

Add the following to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/hooks/plan-metadata-inject.py"
          }
        ]
      }
    ]
  }
}
```

Or if using directly from this repo:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/ccplans/hooks/plan-metadata/inject.py"
          }
        ]
      }
    ]
  }
}
```

## How it Works

The hook script receives JSON data from Claude Code via stdin when a tool completes. It checks if the tool was `Write` or `Edit` and if the target file is in `~/.claude/plans/`.

### Hook Input (from stdin)

```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/Users/you/.claude/plans/awesome-plan.md",
    "content": "..."
  },
  "cwd": "/Users/you/projects/myapp",
  "session_id": "abc123xyz"
}
```

### Script Logic

```python
# 1. Read hook data from stdin
data = json.load(sys.stdin)

# 2. Check if it's a Write/Edit to ~/.claude/plans/*.md
file_path = data.get('tool_input', {}).get('file_path', '')
if '/.claude/plans/' not in file_path or not file_path.endswith('.md'):
    sys.exit(0)  # Not a plan file, skip

# 3. Parse existing frontmatter (if any)
content = Path(file_path).read_text()
existing_frontmatter, body = parse_frontmatter(content)

# 4. Build new frontmatter (preserve 'created' and 'status')
metadata = {
    'created': existing_frontmatter.get('created') or now(),
    'modified': now(),
    'project_path': data.get('cwd'),
    'session_id': data.get('session_id'),
    'status': existing_frontmatter.get('status') or 'todo',
}

# 5. Write back with new frontmatter
new_content = build_frontmatter(metadata) + '\n' + body
Path(file_path).write_text(new_content)
```

### Key Functions

| Function | Description |
|----------|-------------|
| `parse_frontmatter(content)` | Extracts YAML frontmatter and body from markdown |
| `build_frontmatter(metadata)` | Creates YAML frontmatter string from dict |
| `inject_metadata(file_path, cwd, session_id)` | Main logic to update a plan file |

## Requirements

- Python 3.8+
- No external dependencies (uses only standard library)

## Updating Status

The hook preserves the `status` field, so you can manually update it:

```yaml
---
status: in_progress  # Changed from 'todo'
---
```

Or use ccplans web UI to update the status (coming soon).

## Troubleshooting

### Hook not running

1. Verify the path in `settings.json` is correct
2. Ensure the script is executable: `chmod +x inject.py`
3. Check Python is available: `which python3`

### Metadata not appearing

1. The hook only processes files in `~/.claude/plans/`
2. Only `.md` files are processed
3. Check file permissions
