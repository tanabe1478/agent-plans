import { List } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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

export function SectionNav({ content }: SectionNavProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(true);
  const headings = extractHeadings(content);

  const handleScroll = useCallback(() => {
    const headingElements = headings
      .map((h) => ({ id: h.id, el: document.getElementById(h.id) }))
      .filter((h) => h.el != null);

    let currentId = '';
    for (const { id, el } of headingElements) {
      const rect = el?.getBoundingClientRect();
      if (rect && rect.top <= 120) {
        currentId = id;
      }
    }
    setActiveId(currentId);
  }, [headings]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (headings.length === 0) return null;

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className="section-nav">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 text-sm font-semibold text-muted-foreground mb-2 hover:text-foreground lg:cursor-default"
      >
        <List className="h-4 w-4" />
        <span>目次</span>
        <span className="ml-auto text-xs lg:hidden">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <ul className="space-y-1">
          {headings.map((heading) => (
            <li key={heading.id}>
              <button
                onClick={() => scrollToHeading(heading.id)}
                className={`section-nav-item w-full text-left text-sm truncate transition-colors ${
                  heading.level === 1
                    ? 'pl-0 font-medium'
                    : heading.level === 2
                      ? 'pl-3'
                      : 'pl-6 text-xs'
                } ${
                  activeId === heading.id
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
