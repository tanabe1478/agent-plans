#!/bin/bash
# Remind to update specs when creating a PR that touches trigger files.
# Hook type: PreToolUse (Bash) — runs before gh pr create

COMMAND="$CLAUDE_BASH_COMMAND"
if [ -z "$COMMAND" ]; then
  exit 0
fi

# Only trigger on PR creation
if ! echo "$COMMAND" | grep -q "gh pr create"; then
  exit 0
fi

# Check staged/changed files for trigger patterns
CHANGED_FILES=$(git diff --name-only HEAD~1..HEAD 2>/dev/null)
if [ -z "$CHANGED_FILES" ]; then
  CHANGED_FILES=$(git diff --name-only --cached 2>/dev/null)
fi

SPECS_TO_UPDATE=""

if echo "$CHANGED_FILES" | grep -qE "(planService|metadataService|fileWatcherService|archiveService)\.ts"; then
  SPECS_TO_UPDATE="$SPECS_TO_UPDATE\n  - docs/specs/plan-data-flow.md"
fi

if echo "$CHANGED_FILES" | grep -qE "(searchService|queryParser)\.ts"; then
  SPECS_TO_UPDATE="$SPECS_TO_UPDATE\n  - docs/specs/search-query.md"
fi

if echo "$CHANGED_FILES" | grep -qE "(preload/index\.ts|src/main/ipc/)"; then
  SPECS_TO_UPDATE="$SPECS_TO_UPDATE\n  - docs/specs/ipc-bridge.md"
fi

if echo "$CHANGED_FILES" | grep -qE "(settingsService|SettingsPage)\.tsx?"; then
  SPECS_TO_UPDATE="$SPECS_TO_UPDATE\n  - docs/specs/settings-config.md"
fi

if [ -n "$SPECS_TO_UPDATE" ]; then
  echo "Reminder: This PR touches trigger files. Consider updating these specs:"
  echo -e "$SPECS_TO_UPDATE"
fi
