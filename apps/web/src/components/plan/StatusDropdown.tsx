import type { PlanStatus } from '@ccplans/shared';
import { STATUS_TRANSITIONS } from '@ccplans/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';

interface StatusDropdownProps {
  currentStatus: PlanStatus | undefined;
  onStatusChange: (status: PlanStatus) => void;
  disabled?: boolean;
}

export function StatusDropdown({ currentStatus, onStatusChange, disabled }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const effectiveStatus = currentStatus ?? 'todo';

  const availableStatuses = useMemo(() => {
    return STATUS_TRANSITIONS[effectiveStatus] ?? [];
  }, [effectiveStatus]);

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

  const handleSelect = (status: PlanStatus) => {
    if (status !== currentStatus) {
      onStatusChange(status);
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
          {availableStatuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => handleSelect(status)}
              className={cn(
                'w-full rounded px-2 py-1.5 text-left hover:bg-accent',
                status === currentStatus && 'bg-accent'
              )}
            >
              <StatusBadge status={status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
