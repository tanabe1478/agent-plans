import { AVAILABLE_STATUS_COLORS } from '@agent-plans/shared';
import { Check } from 'lucide-react';

interface ColorPaletteProps {
  value: string;
  onChange: (color: string) => void;
  size?: 'sm' | 'md';
}

export function ColorPalette({ value, onChange, size = 'md' }: ColorPaletteProps) {
  const dotSize = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const checkSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <fieldset aria-label="Color selection" className="flex flex-wrap gap-1.5 border-0 p-0 m-0">
      {AVAILABLE_STATUS_COLORS.map((color) => {
        const isSelected = value === color.name;
        return (
          <button
            key={color.name}
            type="button"
            aria-label={`${color.name}${isSelected ? ' (selected)' : ''}`}
            onClick={() => onChange(color.name)}
            className={`${dotSize} rounded-full flex items-center justify-center transition-all ${
              isSelected ? 'ring-2 ring-offset-1 ring-primary' : 'hover:scale-110'
            }`}
            style={{ backgroundColor: color.hex }}
          >
            {isSelected && <Check className={`${checkSize} text-white drop-shadow`} />}
          </button>
        );
      })}
    </fieldset>
  );
}
