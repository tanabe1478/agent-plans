#!/bin/bash
# Warn if a spec's "Last updated" date is older than 90 days.
# Hook type: PostToolUse (Read) — runs when a spec is read

FILE="$CLAUDE_FILE_PATH"
if [ -z "$FILE" ]; then
  exit 0
fi

# Only check files in docs/specs/
if ! echo "$FILE" | grep -q "docs/specs/"; then
  exit 0
fi

LAST_UPDATED=$(grep -m1 "^> Last updated:" "$FILE" 2>/dev/null | sed 's/^> Last updated: //')
if [ -z "$LAST_UPDATED" ]; then
  echo "Warning: $FILE has no 'Last updated' header. Consider adding one."
  exit 0
fi

# Calculate age in days
if command -v gdate &>/dev/null; then
  DATE_CMD="gdate"
else
  DATE_CMD="date"
fi

SPEC_EPOCH=$($DATE_CMD -d "$LAST_UPDATED" +%s 2>/dev/null)
if [ -z "$SPEC_EPOCH" ]; then
  # macOS date fallback
  SPEC_EPOCH=$(date -j -f "%Y-%m-%d" "$LAST_UPDATED" +%s 2>/dev/null)
fi

if [ -z "$SPEC_EPOCH" ]; then
  exit 0
fi

NOW_EPOCH=$($DATE_CMD +%s 2>/dev/null || date +%s)
AGE_DAYS=$(( (NOW_EPOCH - SPEC_EPOCH) / 86400 ))

if [ "$AGE_DAYS" -gt 90 ]; then
  echo "Warning: $(basename "$FILE") was last updated $AGE_DAYS days ago ($LAST_UPDATED). Consider refreshing this spec."
fi
