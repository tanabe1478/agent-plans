#!/bin/bash
# Suggest relevant spec when editing a trigger file.
# Hook type: PostToolUse (Edit, Write)

FILE="$CLAUDE_FILE_PATH"
if [ -z "$FILE" ]; then
  exit 0
fi

BASENAME=$(basename "$FILE")

case "$BASENAME" in
  planService.ts|metadataService.ts|fileWatcherService.ts|archiveService.ts)
    echo "Relevant spec: docs/specs/plan-data-flow.md — Plan CRUD, metadata sync, conflict detection"
    ;;
  searchService.ts|queryParser.ts)
    echo "Relevant spec: docs/specs/search-query.md — Full-text search, query syntax, filter matching"
    ;;
  index.ts)
    if echo "$FILE" | grep -q "preload"; then
      echo "Relevant spec: docs/specs/ipc-bridge.md — IPC channel reference, contextBridge API"
    fi
    ;;
  settingsService.ts|SettingsPage.tsx)
    echo "Relevant spec: docs/specs/settings-config.md — Settings schema, normalization, file watcher"
    ;;
esac

# IPC handler directory
if echo "$FILE" | grep -q "src/main/ipc/"; then
  echo "Relevant spec: docs/specs/ipc-bridge.md — IPC channel reference"
fi
