#!/usr/bin/env python3
"""
Plan Metadata Injector Hook for Claude Code

This script is designed to be used as a PostToolUse hook in Claude Code.
It injects YAML frontmatter with metadata into plan files when they are
created or modified.

Usage in ~/.claude/settings.json:
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/inject.py"
          }
        ]
      }
    ]
  }
}
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, Tuple


def get_plans_dir() -> Path:
    """Get the Claude plans directory path."""
    return Path.home() / ".claude" / "plans"


def parse_frontmatter(content: str) -> Tuple[Optional[Dict[str, str]], str]:
    """
    Parse YAML frontmatter from markdown content.

    Returns:
        tuple: (frontmatter_dict or None, body_content)
    """
    pattern = r"^---\n(.*?)\n---\n(.*)$"
    match = re.match(pattern, content, re.DOTALL)

    if not match:
        return None, content

    frontmatter_str = match.group(1)
    body = match.group(2)

    # Simple YAML parsing (key: value format only)
    frontmatter = {}
    for line in frontmatter_str.split("\n"):
        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip()
            # Remove quotes if present
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]
            frontmatter[key] = value

    return frontmatter, body


def build_frontmatter(metadata: Dict[str, str]) -> str:
    """Build YAML frontmatter string from metadata dict."""
    lines = ["---"]
    for key, value in metadata.items():
        # Quote strings that might need it
        if isinstance(value, str) and (" " in value or ":" in value):
            value = f'"{value}"'
        lines.append(f"{key}: {value}")
    lines.append("---")
    return "\n".join(lines)


def inject_metadata(file_path: Path, cwd: str, session_id: str) -> bool:
    """
    Inject or update frontmatter metadata in a plan file.

    Args:
        file_path: Path to the plan file
        cwd: Current working directory (project path)
        session_id: Claude Code session ID

    Returns:
        bool: True if file was modified, False otherwise
    """
    if not file_path.exists():
        return False

    content = file_path.read_text(encoding="utf-8")
    existing_fm, body = parse_frontmatter(content)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Build new metadata (overwrite strategy, but preserve 'created')
    metadata = {
        "created": existing_fm.get("created", now) if existing_fm else now,
        "modified": now,
        "project_path": cwd,
        "session_id": session_id,
        "status": existing_fm.get("status", "todo") if existing_fm else "todo",
    }

    new_frontmatter = build_frontmatter(metadata)
    new_content = f"{new_frontmatter}\n{body.lstrip()}"

    file_path.write_text(new_content, encoding="utf-8")
    return True


def main():
    """Main entry point for the hook."""
    # Read hook data from stdin
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)  # Silent exit on invalid input

    # Extract relevant fields
    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})
    cwd = data.get("cwd", "")
    session_id = data.get("session_id", "")

    # Only process Write and Edit tools
    if tool_name not in ("Write", "Edit"):
        sys.exit(0)

    # Get file path from tool input
    file_path_str = tool_input.get("file_path", "")
    if not file_path_str:
        sys.exit(0)

    file_path = Path(file_path_str)
    plans_dir = get_plans_dir()

    # Check if file is in the plans directory
    try:
        file_path.relative_to(plans_dir)
    except ValueError:
        # File is not in plans directory
        sys.exit(0)

    # Check if it's a markdown file
    if file_path.suffix.lower() != ".md":
        sys.exit(0)

    # Inject metadata
    inject_metadata(file_path, cwd, session_id)


if __name__ == "__main__":
    main()
