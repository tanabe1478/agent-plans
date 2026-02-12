import type { DeadlineCategory, PlanMeta } from '@ccplans/shared';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isOverdue(dueDate: string): boolean {
  const due = endOfDay(new Date(dueDate));
  const now = new Date();
  return due < now && !isToday(dueDate);
}

export function isToday(dueDate: string): boolean {
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(new Date());
  return due.getTime() === today.getTime();
}

export function isThisWeek(dueDate: string): boolean {
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(new Date());
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return due >= monday && due <= sunday && !isToday(dueDate);
}

export function getDeadlineColor(dueDate?: string): string {
  if (!dueDate) return '';
  if (isOverdue(dueDate)) return 'border-red-500 dark:border-red-400';
  if (isToday(dueDate)) return 'border-orange-500 dark:border-orange-400';
  if (isThisWeek(dueDate)) return 'border-yellow-500 dark:border-yellow-400';
  return '';
}

export function getDeadlineBgColor(dueDate?: string): string {
  if (!dueDate) return '';
  if (isOverdue(dueDate)) return 'bg-red-50 dark:bg-red-950/30';
  if (isToday(dueDate)) return 'bg-orange-50 dark:bg-orange-950/30';
  if (isThisWeek(dueDate)) return 'bg-yellow-50 dark:bg-yellow-950/30';
  return '';
}

export function formatRelativeDeadline(dueDate: string): string {
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(new Date());
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)}日超過`;
  if (diffDays === 0) return '今日';
  if (diffDays === 1) return '明日';
  if (diffDays <= 7) return `${diffDays}日後`;
  if (diffDays <= 30) return `${Math.ceil(diffDays / 7)}週間後`;
  return `${Math.ceil(diffDays / 30)}ヶ月後`;
}

export function categorizeByDeadline(plans: PlanMeta[]): DeadlineCategory {
  const result: DeadlineCategory = {
    overdue: [],
    today: [],
    thisWeek: [],
    later: [],
    noDueDate: [],
  };

  for (const plan of plans) {
    const dueDate = plan.frontmatter?.dueDate;
    if (!dueDate) {
      result.noDueDate.push(plan);
    } else if (isOverdue(dueDate)) {
      result.overdue.push(plan);
    } else if (isToday(dueDate)) {
      result.today.push(plan);
    } else if (isThisWeek(dueDate)) {
      result.thisWeek.push(plan);
    } else {
      result.later.push(plan);
    }
  }

  return result;
}

export function downloadFile(
  filename: string,
  content: string | Uint8Array | ArrayBuffer,
  mimeType: string
): void {
  const normalizedContent =
    typeof content === 'string'
      ? content
      : content instanceof ArrayBuffer
        ? content
        : Uint8Array.from(content);
  const blob = new Blob([normalizedContent], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
