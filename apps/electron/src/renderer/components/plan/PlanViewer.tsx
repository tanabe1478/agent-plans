import type { PlanDetail } from '@agent-plans/shared';
import { type ComponentType, createElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
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

type LineNumberedProps = {
  node?: NodeWithPosition;
  children?: ReactNode;
} & Record<string, unknown>;

function lineNumberComponent(tag: string): ComponentType<LineNumberedProps> {
  return function LineNumbered({ node, children, ...props }: LineNumberedProps) {
    const typedNode = node as NodeWithPosition | undefined;
    const line = typedNode?.position?.start?.line;
    return createElement(
      tag,
      { ...(props as object), 'data-line': line },
      line != null
        ? createElement('span', { className: 'line-number-gutter', 'aria-hidden': 'true' }, line)
        : null,
      children as ReactNode
    );
  };
}

const lineNumberComponents: Record<string, ComponentType<LineNumberedProps>> = {};
const blockTags = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'blockquote',
  'pre',
  'table',
  'hr',
  'ul',
  'ol',
];

for (const tag of blockTags) {
  lineNumberComponents[tag] = lineNumberComponent(tag);
}

export function PlanViewer({ plan, showLineNumbers = false }: PlanViewerProps) {
  const meta = plan.metadata ?? plan.frontmatter;

  return (
    <div>
      <SubtaskList filename={plan.filename} subtasks={meta?.subtasks || []} />
      <article
        data-plan-content="true"
        className={`markdown-content mt-6${showLineNumbers ? ' with-line-numbers' : ''}`}
      >
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
