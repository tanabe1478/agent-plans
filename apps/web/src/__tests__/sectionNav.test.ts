import { describe, expect, it } from 'vitest';
import { extractHeadings, slugify } from '../components/plan/SectionNav';

describe('slugify', () => {
  it('should convert text to lowercase kebab-case', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('should remove special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('should collapse multiple spaces into single dash', () => {
    expect(slugify('hello   world')).toBe('hello-world');
  });

  it('should collapse multiple dashes into single dash', () => {
    expect(slugify('hello---world')).toBe('hello-world');
  });

  it('should strip non-word characters like Japanese', () => {
    expect(slugify('概要')).toBe('');
  });

  it('should handle mixed text', () => {
    expect(slugify('Step 1: Setup')).toBe('step-1-setup');
  });

  it('should trim leading/trailing whitespace but not dashes', () => {
    expect(slugify('  hello  ')).toBe('-hello-');
  });

  it('should handle empty string', () => {
    expect(slugify('')).toBe('');
  });
});

describe('extractHeadings', () => {
  it('should extract h1, h2, h3 headings', () => {
    const content = `# Title
## Section
### Subsection`;
    const headings = extractHeadings(content);
    expect(headings).toHaveLength(3);
    expect(headings[0]).toEqual({ level: 1, text: 'Title', id: 'title' });
    expect(headings[1]).toEqual({ level: 2, text: 'Section', id: 'section' });
    expect(headings[2]).toEqual({ level: 3, text: 'Subsection', id: 'subsection' });
  });

  it('should ignore headings inside code blocks', () => {
    const content = `# Real Heading
\`\`\`markdown
# Not A Heading
## Also Not
\`\`\`
## Another Real Heading`;
    const headings = extractHeadings(content);
    expect(headings).toHaveLength(2);
    expect(headings[0].text).toBe('Real Heading');
    expect(headings[1].text).toBe('Another Real Heading');
  });

  it('should handle indented code block fences', () => {
    const content = `# Title
  \`\`\`
  # Inside Code
  \`\`\`
## After Code`;
    const headings = extractHeadings(content);
    expect(headings).toHaveLength(2);
    expect(headings[0].text).toBe('Title');
    expect(headings[1].text).toBe('After Code');
  });

  it('should return empty array for content without headings', () => {
    const content = 'Just plain text\nWith multiple lines\nBut no headings';
    expect(extractHeadings(content)).toEqual([]);
  });

  it('should return empty array for empty content', () => {
    expect(extractHeadings('')).toEqual([]);
  });

  it('should ignore h4+ headings', () => {
    const content = `# H1
## H2
### H3
#### H4
##### H5`;
    const headings = extractHeadings(content);
    expect(headings).toHaveLength(3);
    expect(headings.map((h) => h.level)).toEqual([1, 2, 3]);
  });

  it('should handle headings with special characters', () => {
    const content = '## Step 1: Configuration & Setup';
    const headings = extractHeadings(content);
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('Step 1: Configuration & Setup');
    expect(headings[0].id).toBe('step-1-configuration-setup');
  });

  it('should require space after hash marks', () => {
    const content = `#NoSpace
##AlsoNoSpace
# Valid Heading`;
    const headings = extractHeadings(content);
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('Valid Heading');
  });

  it('should handle multiple code blocks', () => {
    const content = `# Before
\`\`\`
# In Code 1
\`\`\`
## Between
\`\`\`typescript
# In Code 2
\`\`\`
### After`;
    const headings = extractHeadings(content);
    expect(headings).toHaveLength(3);
    expect(headings.map((h) => h.text)).toEqual(['Before', 'Between', 'After']);
  });

  it('should generate unique-looking slugs for different headings', () => {
    const content = `## Introduction
## Implementation
## Conclusion`;
    const headings = extractHeadings(content);
    const ids = headings.map((h) => h.id);
    expect(ids).toEqual(['introduction', 'implementation', 'conclusion']);
    expect(new Set(ids).size).toBe(3);
  });
});
