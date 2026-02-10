import { createElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import type { PlanDetail } from '@ccplans/shared';
import { SubtaskList } from './SubtaskList';

interface PlanViewerProps {
  plan: PlanDetail;
  showLineNumbers?: boolean;
}

interface NodeWithPosition {
  position?: {
    start?: { line?: number };
  };
}

function lineNumberComponent(tag: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function LineNumbered({ node, children, ...props }: any) {
    const typedNode = node as NodeWithPosition | undefined;
    const line = typedNode?.position?.start?.line;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lineNumberComponents: Record<string, any> = {};
const blockTags = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'blockquote', 'pre', 'table', 'hr',
  'ul', 'ol',
];

for (const tag of blockTags) {
  lineNumberComponents[tag] = lineNumberComponent(tag);
}

export function PlanViewer({ plan, showLineNumbers = false }: PlanViewerProps) {
  return (
    <div>
      <SubtaskList
        filename={plan.filename}
        subtasks={plan.frontmatter?.subtasks || []}
      />
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
