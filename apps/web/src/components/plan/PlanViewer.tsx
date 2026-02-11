import { createElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import type { PlanDetail } from '@ccplans/shared';
import { SubtaskList } from './SubtaskList';
import { useFrontmatterEnabled } from '@/contexts/SettingsContext';

interface PlanViewerProps {
  plan: PlanDetail;
  showLineNumbers?: boolean;
}

interface NodeWithPosition {
  position?: {
    start?: { line?: number };
  };
}

interface LineNumberedProps {
  node?: NodeWithPosition;
  children?: ReactNode;
  [key: string]: unknown;
}

function lineNumberComponent(tag: string) {
  return function LineNumbered({ node, children, ...props }: LineNumberedProps) {
    const line = node?.position?.start?.line;
    return createElement(
      tag,
      { ...props, 'data-line': line },
      line != null
        ? createElement(
            'span',
            { className: 'line-number-gutter', 'aria-hidden': 'true' },
            line,
          )
        : null,
      children as ReactNode,
    );
  };
}

const lineNumberComponents: Record<string, ReturnType<typeof lineNumberComponent>> = {};
const blockTags = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'blockquote', 'pre', 'table', 'hr',
  'ul', 'ol',
];

for (const tag of blockTags) {
  lineNumberComponents[tag] = lineNumberComponent(tag);
}

export function PlanViewer({ plan, showLineNumbers = false }: PlanViewerProps) {
  const fmEnabled = useFrontmatterEnabled();

  return (
    <div>
      {fmEnabled && (
        <SubtaskList
          filename={plan.filename}
          subtasks={plan.frontmatter?.subtasks || []}
        />
      )}
      <article className={`markdown-content mt-6${showLineNumbers ? ' with-line-numbers' : ''}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight, rehypeSlug]}
          components={showLineNumbers ? lineNumberComponents : undefined}
        >
          {plan.content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
