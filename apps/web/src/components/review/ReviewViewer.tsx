import { createElement, useRef, useState, useCallback, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import type { PlanDetail } from '@ccplans/shared';
import type { ReviewComment } from '@/lib/types/review';
import { CommentForm } from './CommentForm';
import { InlineComment } from './InlineComment';

interface ReviewViewerProps {
  plan: PlanDetail;
  comments: ReviewComment[];
  onAddComment: (line: number | [number, number], body: string) => ReviewComment;
  onUpdateComment: (id: string, body: string) => void;
  onDeleteComment: (id: string) => void;
  onCopyPrompt: (comment: ReviewComment) => void;
}

interface NodeWithPosition {
  position?: {
    start?: { line?: number };
  };
}

function getCommentsForLine(comments: ReviewComment[], line: number): ReviewComment[] {
  return comments.filter((c) => {
    if (Array.isArray(c.line)) {
      return c.line[0] === line;
    }
    return c.line === line;
  });
}

export function ReviewViewer({
  plan,
  comments,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onCopyPrompt,
}: ReviewViewerProps) {
  const [activeForm, setActiveForm] = useState<{ line: number | [number, number] } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const dragStartRef = useRef<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const isDraggingRef = useRef(false);

  const handleGutterMouseDown = useCallback((line: number) => {
    dragStartRef.current = line;
    isDraggingRef.current = false;
    setDragEnd(null);
  }, []);

  const handleGutterMouseEnter = useCallback((line: number) => {
    if (dragStartRef.current != null) {
      isDraggingRef.current = true;
      setDragEnd(line);
    }
  }, []);

  const handleGutterMouseUp = useCallback(
    (line: number) => {
      const start = dragStartRef.current;
      if (start == null) return;

      let selectedLine: number | [number, number];
      if (isDraggingRef.current && start !== line) {
        const lo = Math.min(start, line);
        const hi = Math.max(start, line);
        selectedLine = [lo, hi];
      } else {
        selectedLine = start;
      }

      dragStartRef.current = null;
      isDraggingRef.current = false;
      setDragEnd(null);
      setEditingId(null);
      setActiveForm({ line: selectedLine });
    },
    [],
  );

  const handleFormSubmit = useCallback(
    (body: string) => {
      if (activeForm) {
        onAddComment(activeForm.line, body);
        setActiveForm(null);
      }
    },
    [activeForm, onAddComment],
  );

  const handleFormCancel = useCallback(() => {
    setActiveForm(null);
  }, []);

  const isLineInDragRange = useCallback(
    (line: number): boolean => {
      const start = dragStartRef.current;
      if (start == null || dragEnd == null) return false;
      const lo = Math.min(start, dragEnd);
      const hi = Math.max(start, dragEnd);
      return line >= lo && line <= hi;
    },
    [dragEnd],
  );

  const hasCommentOnLine = useCallback(
    (line: number): boolean => {
      return comments.some((c) => {
        if (Array.isArray(c.line)) {
          return line >= c.line[0] && line <= c.line[1];
        }
        return c.line === line;
      });
    },
    [comments],
  );

  function reviewLineNumberComponent(tag: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function ReviewLineNumbered({ node, children, ...props }: any) {
      const typedNode = node as NodeWithPosition | undefined;
      const line = typedNode?.position?.start?.line;
      const lineComments = line != null ? getCommentsForLine(comments, line) : [];
      const showForm = activeForm != null && !Array.isArray(activeForm.line) && activeForm.line === line;
      const showFormRange = activeForm != null && Array.isArray(activeForm.line) && activeForm.line[0] === line;
      const hasComment = line != null && hasCommentOnLine(line);
      const inDragRange = line != null && isLineInDragRange(line);

      return createElement(
        'div',
        { key: line },
        createElement(
          tag,
          {
            ...props,
            'data-line': line,
            className: [
              props.className || '',
              hasComment ? 'has-comment' : '',
              inDragRange ? 'selecting' : '',
            ]
              .filter(Boolean)
              .join(' '),
          },
          line != null
            ? createElement(
                'span',
                {
                  className: 'line-number-gutter review-gutter',
                  'aria-hidden': 'true',
                  onMouseDown: (e: React.MouseEvent) => {
                    e.preventDefault();
                    handleGutterMouseDown(line);
                  },
                  onMouseEnter: () => handleGutterMouseEnter(line),
                  onMouseUp: () => handleGutterMouseUp(line),
                },
                line,
              )
            : null,
          children as ReactNode,
        ),
        // Render inline comments and form after the block element
        ...lineComments.map((comment) =>
          createElement(
            'div',
            { key: comment.id },
            createElement(InlineComment, {
              comment,
              isEditing: editingId === comment.id,
              onEdit: () => setEditingId(comment.id),
              onDelete: () => {
                onDeleteComment(comment.id);
                if (editingId === comment.id) setEditingId(null);
              },
              onCopyPrompt: () => onCopyPrompt(comment),
              onEditSubmit: (body: string) => {
                onUpdateComment(comment.id, body);
                setEditingId(null);
              },
              onEditCancel: () => setEditingId(null),
            }),
          ),
        ),
        (showForm || showFormRange)
          ? createElement(CommentForm, {
              key: 'form',
              line: activeForm!.line,
              onSubmit: handleFormSubmit,
              onCancel: handleFormCancel,
            })
          : null,
      );
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviewComponents: Record<string, any> = {};
  const blockTags = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'blockquote', 'pre', 'table', 'hr',
    'ul', 'ol',
  ];

  for (const t of blockTags) {
    reviewComponents[t] = reviewLineNumberComponent(t);
  }

  return (
    <article className="markdown-content with-line-numbers review-mode mt-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
        components={reviewComponents}
      >
        {plan.content}
      </ReactMarkdown>
    </article>
  );
}
