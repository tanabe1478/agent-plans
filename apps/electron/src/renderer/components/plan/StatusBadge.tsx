import { getColorClassName, useStatusColumns } from '../../lib/hooks/useStatusColumns';
import { cn } from '../../lib/utils';

interface StatusBadgeProps {
  status: string | undefined;
  onClick?: () => void;
  interactive?: boolean;
}

export function StatusBadge({ status, onClick, interactive = false }: StatusBadgeProps) {
  const { getStatusLabel, getStatusColor } = useStatusColumns();

  if (!status) return null;

  const label = getStatusLabel(status);
  const colorClass = getColorClassName(getStatusColor(status));
  const baseClassName = cn(
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
    colorClass,
    interactive && 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-current/30'
  );

  if (onClick && interactive) {
    return (
      <button type="button" onClick={onClick} className={baseClassName}>
        {label}
      </button>
    );
  }

  return <span className={baseClassName}>{label}</span>;
}
