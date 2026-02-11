import type { PlanDetail } from '@ccplans/shared';
import { Fragment, useCallback, useRef, useState } from 'react';
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
  extractQuotedLines: (line: number | [number, number]) => string;
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
  extractQuotedLines,
}: ReviewViewerProps) {
  const [activeForm, setActiveForm] = useState<{ line: number | [number, number] } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const dragStartRef = useRef<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const [lastClickedLine, setLastClickedLine] = useState<number | null>(null);
  const [selectedRange, setSelectedRange] = useState<[number, number] | null>(null);

  const handleGutterMouseDown = useCallback((line: number, shiftKey: boolean) => {
    if (shiftKey) return;
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
    (line: number, shiftKey: boolean) => {
      if (shiftKey && lastClickedLine != null) {
        const lo = Math.min(lastClickedLine, line);
        const hi = Math.max(lastClickedLine, line);
        const range: [number, number] = [lo, hi];
        setSelectedRange(range);
        setEditingId(null);
        setActiveForm({ line: range });
        setLastClickedLine(line);
        dragStartRef.current = null;
        isDraggingRef.current = false;
        setDragEnd(null);
        return;
      }

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
      setSelectedRange(null);
      setEditingId(null);
      setActiveForm({ line: selectedLine });
      setLastClickedLine(line);
    },
    [lastClickedLine]
  );

  const handleFormSubmit = useCallback(
    (body: string) => {
      if (activeForm) {
        onAddComment(activeForm.line, body);
        setActiveForm(null);
        setSelectedRange(null);
      }
    },
    [activeForm, onAddComment]
  );

  const handleFormCancel = useCallback(() => {
    setActiveForm(null);
    setSelectedRange(null);
  }, []);

  const isLineInDragRange = useCallback(
    (line: number): boolean => {
      if (selectedRange != null) {
        return line >= selectedRange[0] && line <= selectedRange[1];
      }
      const start = dragStartRef.current;
      if (start == null || dragEnd == null) return false;
      const lo = Math.min(start, dragEnd);
      const hi = Math.max(start, dragEnd);
      return line >= lo && line <= hi;
    },
    [dragEnd, selectedRange]
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
    [comments]
  );

  const lines = plan.content.split('\n');

  return (
    <div className="review-file">
      <div className="review-file-header">
        <span className="truncate">{plan.filename}</span>
        <span className="shrink-0 text-muted-foreground">{lines.length} lines</span>
      </div>
      <div className="review-file-content">
        <table className="review-diff-table">
          <tbody>
            {lines.map((lineContent, index) => {
              const lineNum = index + 1;
              const lineComments = getCommentsForLine(comments, lineNum);
              const showForm =
                activeForm != null &&
                !Array.isArray(activeForm.line) &&
                activeForm.line === lineNum;
              const showFormRange =
                activeForm != null &&
                Array.isArray(activeForm.line) &&
                activeForm.line[0] === lineNum;
              const hasComment = hasCommentOnLine(lineNum);
              const inRange = isLineInDragRange(lineNum);

              const rowClass = [
                'review-diff-line',
                hasComment ? 'has-comment' : '',
                inRange ? 'selecting' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <Fragment key={lineNum}>
                  <tr className={rowClass} data-line={lineNum}>
                    <td
                      className="review-diff-gutter"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleGutterMouseDown(lineNum, e.shiftKey);
                      }}
                      onMouseEnter={() => handleGutterMouseEnter(lineNum)}
                      onMouseUp={(e) => handleGutterMouseUp(lineNum, e.shiftKey)}
                    >
                      <span className="review-line-num">{lineNum}</span>
                      <span className="review-add-btn">+</span>
                    </td>
                    <td className="review-diff-code">
                      <span>{lineContent}</span>
                    </td>
                  </tr>
                  {lineComments.map((comment) => (
                    <tr key={comment.id} className="review-comment-row">
                      <td colSpan={2} className="review-comment-cell">
                        <InlineComment
                          comment={comment}
                          quotedContent={extractQuotedLines(comment.line)}
                          isEditing={editingId === comment.id}
                          onEdit={() => setEditingId(comment.id)}
                          onDelete={() => {
                            onDeleteComment(comment.id);
                            if (editingId === comment.id) setEditingId(null);
                          }}
                          onCopyPrompt={() => onCopyPrompt(comment)}
                          onEditSubmit={(body: string) => {
                            onUpdateComment(comment.id, body);
                            setEditingId(null);
                          }}
                          onEditCancel={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  ))}
                  {(showForm || showFormRange) && (
                    <tr className="review-comment-row">
                      <td colSpan={2} className="review-comment-cell">
                        <CommentForm
                          line={activeForm?.line}
                          quotedContent={extractQuotedLines(activeForm?.line)}
                          onSubmit={handleFormSubmit}
                          onCancel={handleFormCancel}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
