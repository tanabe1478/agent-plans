import { useState, useCallback } from 'react';
import type { ReviewComment, ReviewCommentsStorage } from '../types/review';

function storageKey(filename: string): string {
  return `ccplans-review-comments-${filename}`;
}

function loadComments(filename: string): ReviewComment[] {
  try {
    const raw = localStorage.getItem(storageKey(filename));
    if (!raw) return [];
    const data: ReviewCommentsStorage = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.comments)) return [];
    return data.comments;
  } catch {
    return [];
  }
}

function saveComments(filename: string, comments: ReviewComment[]): void {
  const data: ReviewCommentsStorage = { version: 1, comments };
  localStorage.setItem(storageKey(filename), JSON.stringify(data));
}

function formatLineRef(line: number | [number, number]): string {
  if (Array.isArray(line)) {
    return `L${line[0]}-L${line[1]}`;
  }
  return `L${line}`;
}

export function useReviewComments(filename: string) {
  const [comments, setComments] = useState<ReviewComment[]>(() =>
    loadComments(filename),
  );

  const persist = useCallback(
    (next: ReviewComment[]) => {
      setComments(next);
      saveComments(filename, next);
    },
    [filename],
  );

  const addComment = useCallback(
    (line: number | [number, number], body: string) => {
      const now = new Date().toISOString();
      const comment: ReviewComment = {
        id: crypto.randomUUID(),
        line,
        body,
        createdAt: now,
        updatedAt: now,
      };
      const next = [...comments, comment];
      persist(next);
      return comment;
    },
    [comments, persist],
  );

  const updateComment = useCallback(
    (id: string, body: string) => {
      const next = comments.map((c) =>
        c.id === id ? { ...c, body, updatedAt: new Date().toISOString() } : c,
      );
      persist(next);
    },
    [comments, persist],
  );

  const deleteComment = useCallback(
    (id: string) => {
      const next = comments.filter((c) => c.id !== id);
      persist(next);
    },
    [comments, persist],
  );

  const clearAllComments = useCallback(() => {
    persist([]);
  }, [persist]);

  const generatePrompt = useCallback(
    (comment: ReviewComment): string => {
      return `${filename}:${formatLineRef(comment.line)}\n${comment.body}`;
    },
    [filename],
  );

  const generateAllPrompts = useCallback((): string => {
    return comments.map((c) => generatePrompt(c)).join('\n\n=====\n\n');
  }, [comments, generatePrompt]);

  return {
    comments,
    addComment,
    updateComment,
    deleteComment,
    clearAllComments,
    generatePrompt,
    generateAllPrompts,
    commentCount: comments.length,
  };
}
