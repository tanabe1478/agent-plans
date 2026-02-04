#!/usr/bin/env python3
"""Tests for plan metadata injector."""

import tempfile
import unittest
from pathlib import Path

from inject import build_frontmatter, inject_metadata, parse_frontmatter


class TestParseFrontmatter(unittest.TestCase):
    def test_no_frontmatter(self):
        content = "# Plan Title\n\nSome content"
        fm, body = parse_frontmatter(content)
        self.assertIsNone(fm)
        self.assertEqual(body, content)

    def test_with_frontmatter(self):
        content = """---
created: 2025-01-15T10:00:00Z
status: todo
---
# Plan Title

Some content"""
        fm, body = parse_frontmatter(content)
        self.assertIsNotNone(fm)
        self.assertEqual(fm["created"], "2025-01-15T10:00:00Z")
        self.assertEqual(fm["status"], "todo")
        self.assertTrue(body.startswith("# Plan Title"))

    def test_quoted_values(self):
        content = """---
project_path: "/path/with spaces/project"
---
# Title"""
        fm, body = parse_frontmatter(content)
        self.assertEqual(fm["project_path"], "/path/with spaces/project")


class TestBuildFrontmatter(unittest.TestCase):
    def test_simple_values(self):
        metadata = {"created": "2025-01-15T10:00:00Z", "status": "todo"}
        result = build_frontmatter(metadata)
        self.assertIn("---", result)
        # Timestamps contain colons, so they get quoted
        self.assertIn('created: "2025-01-15T10:00:00Z"', result)
        self.assertIn("status: todo", result)

    def test_values_with_spaces(self):
        metadata = {"project_path": "/path/with spaces"}
        result = build_frontmatter(metadata)
        self.assertIn('project_path: "/path/with spaces"', result)


class TestInjectMetadata(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def test_inject_new_file(self):
        file_path = Path(self.temp_dir) / "test-plan.md"
        file_path.write_text("# Test Plan\n\nContent here")

        result = inject_metadata(file_path, "/test/project", "session123")

        self.assertTrue(result)
        content = file_path.read_text()
        self.assertTrue(content.startswith("---"))
        self.assertIn("project_path:", content)
        self.assertIn("session_id: session123", content)
        self.assertIn("status: todo", content)

    def test_preserve_created_on_update(self):
        file_path = Path(self.temp_dir) / "test-plan.md"
        original_created = "2025-01-01T00:00:00Z"
        file_path.write_text(
            f"""---
created: {original_created}
status: in_progress
---
# Test Plan"""
        )

        inject_metadata(file_path, "/new/project", "new_session")

        content = file_path.read_text()
        # Timestamps get quoted due to colons
        self.assertIn(f'created: "{original_created}"', content)

    def test_preserve_status_on_update(self):
        file_path = Path(self.temp_dir) / "test-plan.md"
        file_path.write_text(
            """---
created: 2025-01-01T00:00:00Z
status: completed
---
# Test Plan"""
        )

        inject_metadata(file_path, "/project", "session")

        content = file_path.read_text()
        self.assertIn("status: completed", content)

    def test_nonexistent_file(self):
        file_path = Path(self.temp_dir) / "nonexistent.md"
        result = inject_metadata(file_path, "/project", "session")
        self.assertFalse(result)


if __name__ == "__main__":
    unittest.main()
