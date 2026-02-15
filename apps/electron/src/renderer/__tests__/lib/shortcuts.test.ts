import { describe, expect, it } from 'vitest';
import {
  formatShortcutLabel,
  getShortcutFromKeyboardEvent,
  hasModifier,
  matchesShortcut,
  normalizeShortcut,
} from '@/lib/shortcuts';

describe('shortcuts utils', () => {
  it('normalizes shortcut token order and casing', () => {
    expect(normalizeShortcut('shift+mod+k')).toBe('Mod+Shift+K');
  });

  it('formats Mod shortcut for mac label', () => {
    expect(formatShortcutLabel('Mod+K', true)).toBe('Cmd+K');
  });

  it('captures shortcut from keyboard event', () => {
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    expect(getShortcutFromKeyboardEvent(event)).toBe('Meta+K');
  });

  it('requires modifiers when configured', () => {
    expect(hasModifier('K')).toBe(false);
    expect(hasModifier('Meta+K')).toBe(true);
  });

  it('matches keyboard events against shortcut', () => {
    const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true });
    expect(matchesShortcut(event, 'Mod+P')).toBe(true);
    expect(matchesShortcut(event, 'Meta+P')).toBe(false);
  });
});
