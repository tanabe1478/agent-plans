#!/usr/bin/env python3
"""
PostToolUse hook script for injecting YAML frontmatter into plan files.

This script is triggered after Write or Edit tools modify files in plan directories.
It injects/updates metadata including project_path, session_id, and status.

Preservation rules:
- status: preserved if exists, otherwise set to 'todo'
- project_path, session_id: always overwritten with current values
"""

import json
import os
import sys
import re
from pathlib import Path
from typing import Optional, Dict, Tuple, List


def parse_frontmatter(content: str) -> Tuple[Optional[Dict[str, str]], str]:
    """Parse YAML frontmatter from content.

    Returns:
        Tuple of (frontmatter dict or None, body content)
    """
    if not content.startswith('---'):
        return None, content

    match = re.match(r'^---\n(.*?)\n---\n?', content, re.DOTALL)
    if not match:
        return None, content

    frontmatter_text = match.group(1)
    body = content[match.end():]

    # Parse simple YAML (key: value format)
    frontmatter: Dict[str, str] = {}
    for line in frontmatter_text.split('\n'):
        line = line.strip()
        if not line or ':' not in line:
            continue
        key, value = line.split(':', 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        frontmatter[key] = value

    return frontmatter, body


def build_frontmatter(metadata: Dict[str, str]) -> str:
    """Build YAML frontmatter string from metadata dict."""
    lines = ['---']

    # Order: project_path, session_id, status
    ordered_keys = ['project_path', 'session_id', 'status']

    for key in ordered_keys:
        if key in metadata and metadata[key]:
            value = metadata[key]
            # Quote values that contain colons (like ISO timestamps)
            if ':' in value and key != 'status':
                lines.append(f'{key}: "{value}"')
            else:
                lines.append(f'{key}: {value}')

    lines.append('---')
    return '\n'.join(lines)


def inject_metadata(file_path: Path, cwd: str, session_id: str) -> bool:
    """Inject or update frontmatter metadata in a plan file.

    Args:
        file_path: Path to the plan file
        cwd: Current working directory (project path)
        session_id: Agent session ID

    Returns:
        True if file was modified, False otherwise
    """
    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"Error reading file: {e}", file=sys.stderr)
        return False

    existing_fm, body = parse_frontmatter(content)

    # Build new metadata, preserving status
    metadata = {
        'project_path': cwd,
        'session_id': session_id,
        'status': existing_fm.get('status', 'todo') if existing_fm else 'todo',
    }

    new_frontmatter = build_frontmatter(metadata)
    new_content = f"{new_frontmatter}\n{body.lstrip()}"

    try:
        file_path.write_text(new_content, encoding='utf-8')
        return True
    except Exception as e:
        print(f"Error writing file: {e}", file=sys.stderr)
        return False


def get_target_plan_dirs() -> List[Path]:
    """Resolve plan directories handled by this hook.

    Priority:
    1. PLANS_DIR (if provided)
    2. ~/.agent-plans/plans
    3. ~/.claude/plans (legacy)
    """
    candidates: List[Path] = []
    env_plans_dir = os.environ.get('PLANS_DIR')
    if env_plans_dir:
        candidates.append(Path(env_plans_dir).expanduser().resolve())

    candidates.append((Path.home() / '.agent-plans' / 'plans').resolve())
    candidates.append((Path.home() / '.claude' / 'plans').resolve())

    unique: List[Path] = []
    seen = set()
    for candidate in candidates:
        key = str(candidate)
        if key in seen:
            continue
        seen.add(key)
        unique.append(candidate)

    return unique


def is_target_plan_file(file_path: Path, plan_dirs: List[Path]) -> bool:
    """Return True when file_path belongs to one of plan_dirs."""
    for plan_dir in plan_dirs:
        try:
            file_path.relative_to(plan_dir)
            return True
        except ValueError:
            continue
    return False


def main():
    """Main entry point for the hook script."""
    # Read JSON input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    # Extract tool information
    tool_name = input_data.get('tool_name', '')
    tool_input = input_data.get('tool_input', {})
    session_id = input_data.get('session_id', 'unknown')
    cwd = input_data.get('cwd', '')

    # Only process Write and Edit tools
    if tool_name not in ('Write', 'Edit'):
        sys.exit(0)

    # Get the file path from tool input
    file_path_str = tool_input.get('file_path', '')
    if not file_path_str:
        sys.exit(0)

    file_path = Path(file_path_str).expanduser().resolve()

    # Check if the file is in a target plan directory
    plan_dirs = get_target_plan_dirs()
    if not is_target_plan_file(file_path, plan_dirs):
        sys.exit(0)

    # Check if it's a markdown file
    if file_path.suffix.lower() != '.md':
        sys.exit(0)

    # Inject metadata
    if inject_metadata(file_path, cwd, session_id):
        print(f"Injected metadata into {file_path.name}", file=sys.stderr)

    sys.exit(0)


if __name__ == '__main__':
    main()
