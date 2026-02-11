import { GitBranch } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DependencyBadgeProps {
  blockedByCount: number;
  blocksCount: number;
}

export function DependencyBadge({ blockedByCount, blocksCount }: DependencyBadgeProps) {
  if (blockedByCount === 0 && blocksCount === 0) return null;

  const parts: string[] = [];
  if (blockedByCount > 0) {
    parts.push(`Blocked by ${blockedByCount}`);
  }
  if (blocksCount > 0) {
    parts.push(`Blocks ${blocksCount}`);
  }

  return (
    <Link
      to="/dependencies"
      className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      <GitBranch className="h-3 w-3" />
      {parts.join(' / ')}
    </Link>
  );
}
