import { getRawPlanStatus } from '@agent-plans/shared';
import { useEffect, useRef, useState } from 'react';
import { useStatusColumns } from '../../lib/hooks/useStatusColumns';
import { StatusBadge } from './StatusBadge';

interface StatusDropdownProps {
  currentStatus: string | undefined;
  onStatusChange: (status: string) => void;
  disabled?: boolean;
}

export function StatusDropdown({ currentStatus, onStatusChange, disabled }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { columns } = useStatusColumns();

  const effectiveStatus = getRawPlanStatus(currentStatus);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (statusId: string) => {
    if (statusId !== effectiveStatus) {
      onStatusChange(statusId);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <StatusBadge
        status={effectiveStatus}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        interactive
      />
      {isOpen && (
        <div className="absolute z-50 mt-1 min-w-[120px] rounded-md border bg-popover p-1 shadow-md">
          {columns
            .filter((col) => col.id !== effectiveStatus)
            .map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => handleSelect(col.id)}
                className="w-full rounded px-2 py-1.5 text-left hover:bg-accent"
              >
                <StatusBadge status={col.id} />
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
