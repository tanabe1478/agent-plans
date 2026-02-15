const MODIFIER_TOKENS = ['Mod', 'Meta', 'Ctrl', 'Alt', 'Shift'] as const;

type ModifierToken = (typeof MODIFIER_TOKENS)[number];

interface ParsedShortcut {
  modifiers: Set<ModifierToken>;
  key: string | null;
}

function normalizeModifierToken(token: string): ModifierToken | null {
  const normalized = token.trim().toLowerCase();
  switch (normalized) {
    case 'mod':
      return 'Mod';
    case 'meta':
    case 'cmd':
    case 'command':
      return 'Meta';
    case 'ctrl':
    case 'control':
      return 'Ctrl';
    case 'alt':
    case 'option':
      return 'Alt';
    case 'shift':
      return 'Shift';
    default:
      return null;
  }
}

function normalizeKeyToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return '';
  if (trimmed === ' ') return 'Space';

  const lower = trimmed.toLowerCase();
  const specialKeys: Record<string, string> = {
    arrowup: 'ArrowUp',
    arrowdown: 'ArrowDown',
    arrowleft: 'ArrowLeft',
    arrowright: 'ArrowRight',
    escape: 'Escape',
    esc: 'Escape',
    enter: 'Enter',
    return: 'Enter',
    tab: 'Tab',
    backspace: 'Backspace',
    delete: 'Delete',
    space: 'Space',
  };

  if (specialKeys[lower]) {
    return specialKeys[lower];
  }

  if (trimmed.length === 1) {
    return trimmed.toUpperCase();
  }

  return `${trimmed[0]?.toUpperCase() ?? ''}${trimmed.slice(1)}`;
}

function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

  const modifiers = new Set<ModifierToken>();
  let key: string | null = null;

  for (const part of parts) {
    const modifier = normalizeModifierToken(part);
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }
    key = normalizeKeyToken(part);
  }

  return { modifiers, key };
}

function hasAnyModifier(modifiers: Set<ModifierToken>): boolean {
  return modifiers.size > 0;
}

export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac/i.test(navigator.platform || '');
}

export function normalizeShortcut(shortcut: string): string {
  const parsed = parseShortcut(shortcut);
  const orderedModifiers = MODIFIER_TOKENS.filter((token) => parsed.modifiers.has(token));
  if (!parsed.key) {
    return orderedModifiers.join('+');
  }
  return [...orderedModifiers, parsed.key].join('+');
}

export function hasModifier(shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);
  return hasAnyModifier(parsed.modifiers);
}

export function formatShortcutLabel(shortcut: string, macOS: boolean): string {
  const parsed = parseShortcut(shortcut);
  const orderedModifiers = MODIFIER_TOKENS.filter((token) => parsed.modifiers.has(token)).map(
    (token) => {
      if (token === 'Mod') return macOS ? 'Cmd' : 'Ctrl';
      if (token === 'Meta') return macOS ? 'Cmd' : 'Meta';
      if (token === 'Alt') return macOS ? 'Opt' : 'Alt';
      return token;
    }
  );

  if (!parsed.key) {
    return orderedModifiers.join('+');
  }
  return [...orderedModifiers, parsed.key].join('+');
}

export function getShortcutFromKeyboardEvent(event: KeyboardEvent): string | null {
  const key = normalizeKeyToken(event.key);
  if (!key || key === 'Meta' || key === 'Control' || key === 'Alt' || key === 'Shift') {
    return null;
  }

  const modifiers: string[] = [];
  if (event.metaKey) modifiers.push('Meta');
  if (event.ctrlKey) modifiers.push('Ctrl');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');

  return normalizeShortcut([...modifiers, key].join('+'));
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);
  if (!parsed.key) return false;

  const eventKey = normalizeKeyToken(event.key);
  if (eventKey !== parsed.key) {
    return false;
  }

  const requiresMod = parsed.modifiers.has('Mod');
  if (requiresMod && !event.metaKey && !event.ctrlKey) {
    return false;
  }

  if (parsed.modifiers.has('Meta') && !event.metaKey) return false;
  if (parsed.modifiers.has('Ctrl') && !event.ctrlKey) return false;
  if (parsed.modifiers.has('Alt') && !event.altKey) return false;
  if (parsed.modifiers.has('Shift') && !event.shiftKey) return false;

  const allowsMeta = parsed.modifiers.has('Meta') || requiresMod;
  const allowsCtrl = parsed.modifiers.has('Ctrl') || requiresMod;
  if (event.metaKey && !allowsMeta) return false;
  if (event.ctrlKey && !allowsCtrl) return false;
  if (event.altKey && !parsed.modifiers.has('Alt')) return false;
  if (event.shiftKey && !parsed.modifiers.has('Shift')) return false;

  return true;
}
