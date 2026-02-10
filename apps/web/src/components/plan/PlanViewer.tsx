import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import type { PlanDetail } from '@ccplans/shared';

interface PlanViewerProps {
  plan: PlanDetail;
}

export function PlanViewer({ plan }: PlanViewerProps) {
  return (
    <article className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {plan.content}
      </ReactMarkdown>
    </article>
  );
}
