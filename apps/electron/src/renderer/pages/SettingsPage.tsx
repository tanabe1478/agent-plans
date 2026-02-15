import { type AppShortcuts, DEFAULT_SHORTCUTS, type ShortcutAction } from '@ccplans/shared';
import {
  AlertCircle,
  CheckSquare,
  Clock,
  Columns,
  GitBranch,
  Keyboard,
  Loader2,
} from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useSettings, useUpdateSettings } from '@/lib/hooks/useSettings';
import {
  formatShortcutLabel,
  getShortcutFromKeyboardEvent,
  hasModifier,
  isMacOS,
} from '@/lib/shortcuts';
import { useUiStore } from '@/stores/uiStore';

const FRONTMATTER_FEATURES = [
  { icon: CheckSquare, label: 'Status management (ToDo, In Progress, Review, Completed)' },
  { icon: Columns, label: 'Kanban board view' },
  { icon: GitBranch, label: 'Dependency graph between plans' },
  { icon: CheckSquare, label: 'Subtasks with progress tracking' },
  { icon: Clock, label: 'Due date tracking with deadline alerts' },
];

const SHORTCUT_ITEMS: Array<{
  action: ShortcutAction;
  label: string;
  description: string;
  section: 'Global' | 'Command Palette';
}> = [
  {
    action: 'openCommandPalette',
    label: 'Command Palette',
    description: 'Open the command palette.',
    section: 'Global',
  },
  {
    action: 'openQuickOpen',
    label: 'Quick Open',
    description: 'Open plan search and jump.',
    section: 'Global',
  },
  {
    action: 'commandGoHome',
    label: 'Go to Home',
    description: 'Run "Go to Home" from Command Palette.',
    section: 'Command Palette',
  },
  {
    action: 'commandGoSearch',
    label: 'Go to Search',
    description: 'Run "Go to Search" from Command Palette.',
    section: 'Command Palette',
  },
  {
    action: 'commandOpenSettings',
    label: 'Open Settings',
    description: 'Run "Open Settings" from Command Palette.',
    section: 'Command Palette',
  },
  {
    action: 'commandToggleTheme',
    label: 'Toggle Theme',
    description: 'Run "Toggle Theme" from Command Palette.',
    section: 'Command Palette',
  },
  {
    action: 'commandOpenQuickOpen',
    label: 'Open Quick Open (Command)',
    description: 'Run "Open Quick Open" from Command Palette.',
    section: 'Command Palette',
  },
  {
    action: 'commandOpenCurrentReview',
    label: 'Open Current Review',
    description: 'Run "Open Review for current plan" from Command Palette.',
    section: 'Command Palette',
  },
];

const SHORTCUT_SECTIONS: Array<'Global' | 'Command Palette'> = ['Global', 'Command Palette'];

function areShortcutsEqual(left: AppShortcuts, right: AppShortcuts): boolean {
  return (Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[]).every(
    (action) => left[action] === right[action]
  );
}

export function SettingsPage() {
  const { data: settings, isLoading, error } = useSettings();
  const updateSettings = useUpdateSettings();
  const { addToast } = useUiStore();
  const frontmatterHeadingId = useId();
  const [editingShortcut, setEditingShortcut] = useState<ShortcutAction | null>(null);
  const [localShortcuts, setLocalShortcuts] = useState<AppShortcuts>(DEFAULT_SHORTCUTS);
  const macOS = isMacOS();

  const currentShortcuts: AppShortcuts = useMemo(
    () => ({
      ...DEFAULT_SHORTCUTS,
      ...(settings?.shortcuts ?? {}),
    }),
    [settings?.shortcuts]
  );

  useEffect(() => {
    setLocalShortcuts((previous) => {
      if (areShortcutsEqual(previous, currentShortcuts)) {
        return previous;
      }
      return currentShortcuts;
    });
  }, [currentShortcuts]);

  const handleToggle = async () => {
    const newValue = !settings?.frontmatterEnabled;
    try {
      await updateSettings.mutateAsync({ frontmatterEnabled: newValue });
      addToast(
        newValue ? 'Frontmatter features enabled' : 'Frontmatter features disabled',
        'success'
      );
    } catch {
      addToast('Failed to update settings', 'error');
    }
  };

  useEffect(() => {
    if (!editingShortcut) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setEditingShortcut(null);
        return;
      }

      const captured = getShortcutFromKeyboardEvent(event);
      if (!captured) return;

      if (!hasModifier(captured)) {
        addToast('Shortcut must include at least one modifier key', 'error');
        return;
      }

      const nextShortcuts: AppShortcuts = {
        ...localShortcuts,
        [editingShortcut]: captured,
      };

      setLocalShortcuts(nextShortcuts);
      setEditingShortcut(null);

      void (async () => {
        try {
          await updateSettings.mutateAsync({ shortcuts: nextShortcuts });
          addToast('Shortcut updated', 'success');
        } catch {
          setLocalShortcuts(currentShortcuts);
          addToast('Failed to update shortcut', 'error');
        }
      })();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [addToast, currentShortcuts, editingShortcut, localShortcuts, updateSettings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-destructive">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p>Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="rounded-lg border bg-card p-6 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 id={frontmatterHeadingId} className="text-lg font-semibold">
              Frontmatter Features
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enable YAML frontmatter-based plan management features. These are custom features
              beyond basic Markdown plans.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-labelledby={frontmatterHeadingId}
            aria-checked={settings?.frontmatterEnabled ?? false}
            onClick={handleToggle}
            disabled={updateSettings.isPending}
            className={`
              relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
              transition-colors duration-200 ease-in-out
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              ${settings?.frontmatterEnabled ? 'bg-primary' : 'bg-muted'}
            `}
          >
            <span
              className={`
                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0
                transition duration-200 ease-in-out
                ${settings?.frontmatterEnabled ? 'translate-x-5' : 'translate-x-0'}
              `}
            />
          </button>
        </div>

        <div className="mt-6 border-t pt-4">
          <h3 className="text-sm font-medium mb-3">
            {settings?.frontmatterEnabled
              ? 'Enabled features:'
              : 'Features available when enabled:'}
          </h3>
          <ul className="space-y-2">
            {FRONTMATTER_FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Existing frontmatter data in your plan files is always preserved regardless of this
          setting.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Customize app shortcuts. Click a shortcut and press the new key combination.
            </p>
          </div>
          <Keyboard className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>

        <div className="mt-4 space-y-4">
          {SHORTCUT_SECTIONS.map((section) => {
            const sectionItems = SHORTCUT_ITEMS.filter((item) => item.section === section);
            return (
              <section key={section}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {section}
                </h3>
                <div className="space-y-3">
                  {sectionItems.map((item) => {
                    const isEditing = editingShortcut === item.action;
                    const shortcutLabel = isEditing
                      ? 'Press shortcut...'
                      : formatShortcutLabel(localShortcuts[item.action], macOS);

                    return (
                      <div
                        key={item.action}
                        className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        <button
                          type="button"
                          disabled={updateSettings.isPending}
                          onClick={() => setEditingShortcut(item.action)}
                          className="inline-flex min-w-[172px] items-center justify-center rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {shortcutLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Press Esc while capturing to cancel. Shortcuts must include at least one modifier key.
        </p>
      </div>
    </div>
  );
}
