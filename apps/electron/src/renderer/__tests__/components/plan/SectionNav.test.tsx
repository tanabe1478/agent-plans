import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractHeadings, SectionNav } from '@/components/plan/SectionNav';

describe('SectionNav', () => {
  const scrollIntoViewMock = vi.fn();
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

  beforeAll(() => {
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  beforeEach(() => {
    scrollIntoViewMock.mockReset();
  });

  afterAll(() => {
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it('extractHeadings ignores fenced code blocks', () => {
    const content = `# Top
\`\`\`md
## Hidden
\`\`\`
## Visible`;
    const headings = extractHeadings(content);
    expect(headings.map((h) => h.text)).toEqual(['Top', 'Visible']);
  });

  it('extractHeadings de-duplicates ids for repeated headings', () => {
    const content = `## Repeat
## Repeat
## Repeat`;
    const headings = extractHeadings(content);
    expect(headings.map((h) => h.id)).toEqual(['repeat', 'repeat-1', 'repeat-2']);
  });

  it('scrolls to rendered heading by order even when ids are non-ascii', () => {
    const content = `# 日本語の見出し
## Context`;

    render(
      <>
        <article data-plan-content="true">
          <h1 id="日本語の見出し">日本語の見出し</h1>
          <h2 id="context">Context</h2>
        </article>
        <SectionNav content={content} />
      </>
    );

    fireEvent.click(screen.getByRole('button', { name: '日本語の見出し' }));
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  });
});
