import { describe, expect, it } from 'vitest';
import { DEFAULT_SHORTCUTS, mergeShortcuts } from '../shortcutDefaults';

describe('DEFAULT_SHORTCUTS', () => {
  it('maps commandGoHome to Mod+1', () => {
    expect(DEFAULT_SHORTCUTS.commandGoHome).toBe('Mod+1');
  });

  it('maps commandGoKanban to Mod+2', () => {
    expect(DEFAULT_SHORTCUTS.commandGoKanban).toBe('Mod+2');
  });

  it('maps commandGoSearch to Mod+3', () => {
    expect(DEFAULT_SHORTCUTS.commandGoSearch).toBe('Mod+3');
  });
});

describe('mergeShortcuts', () => {
  it('fills missing commandGoKanban with default', () => {
    const result = mergeShortcuts({ commandGoHome: 'Mod+1' });
    expect(result.commandGoKanban).toBe('Mod+2');
  });

  it('respects user-saved commandGoKanban', () => {
    const result = mergeShortcuts({ commandGoKanban: 'Mod+Shift+K' });
    expect(result.commandGoKanban).toBe('Mod+Shift+K');
  });

  it('returns all defaults when called with null', () => {
    const result = mergeShortcuts(null);
    expect(result.commandGoKanban).toBe('Mod+2');
    expect(result.commandGoSearch).toBe('Mod+3');
    expect(result.commandGoHome).toBe('Mod+1');
  });
});
