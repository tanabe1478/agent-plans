import { Folder } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ProjectBadgeProps {
  projectPath: string | undefined;
  className?: string;
}

export function ProjectBadge({ projectPath, className }: ProjectBadgeProps) {
  if (!projectPath) return null;

  // Extract last directory name for display
  const displayName = projectPath.split('/').filter(Boolean).pop() || projectPath;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[150px]',
        className
      )}
      title={projectPath}
    >
      <Folder className="h-3 w-3 flex-shrink-0" />
      {displayName}
    </span>
  );
}
