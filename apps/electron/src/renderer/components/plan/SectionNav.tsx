import { List } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface SectionNavProps {
  content: string;
}

export interface Heading {
  level: number;
  text: string;
  id: string;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      headings.push({ level, text, id: slugify(text) });
    }
  }

  return headings;
}

function getRenderedHeadingElements(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-plan-content="true"] h1, [data-plan-content="true"] h2, [data-plan-content="true"] h3'
    )
  );
}

export function SectionNav({ content }: SectionNavProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(true);
  const headings = useMemo(() => extractHeadings(content), [content]);

  const handleScroll = useCallback(() => {
    const headingElements = getRenderedHeadingElements();

    let currentIndex = -1;
    headingElements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      if (rect.top <= 120) {
        currentIndex = index;
      }
    });
    setActiveIndex(currentIndex);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (headings.length === 0) return null;

  const scrollToHeading = (index: number) => {
    const el = getRenderedHeadingElements()[index];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className="section-nav">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 text-sm font-semibold text-muted-foreground mb-2 hover:text-foreground lg:cursor-default"
      >
        <List className="h-4 w-4" />
        <span>目次</span>
        <span className="ml-auto text-xs lg:hidden">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <ul className="space-y-1">
          {headings.map((heading, index) => (
            <li key={`${heading.id}-${index}`}>
              <button
                type="button"
                onClick={() => scrollToHeading(index)}
                className={`section-nav-item w-full text-left text-sm truncate transition-colors ${
                  heading.level === 1
                    ? 'pl-0 font-medium'
                    : heading.level === 2
                      ? 'pl-3'
                      : 'pl-6 text-xs'
                } ${
                  activeIndex === index
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={heading.text}
              >
                {heading.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
