import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import type { PlanDetail } from '@ccplans/shared';
import { SubtaskList } from './SubtaskList';

interface PlanViewerProps {
  plan: PlanDetail;
}

export function PlanViewer({ plan }: PlanViewerProps) {
  return (
    <div>
      <SubtaskList
        filename={plan.filename}
        subtasks={plan.frontmatter?.subtasks || []}
      />
      <article className="markdown-content mt-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {plan.content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
