import type { AppShortcuts, ShortcutAction } from '@agent-plans/shared';
import {
  AlertCircle,
  CheckSquare,
  Clock,
  Columns,
  Eye,
  Folder,
  FolderOpen,
  GitBranch,
  Keyboard,
  Loader2,
  Minus,
  Plus,
  Save,
} from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { ipcClient } from '@/lib/api/ipcClient';
import { useSettings, useUpdateSettings } from '@/lib/hooks/useSettings';
import {
  formatShortcutLabel,
  getShortcutFromKeyboardEvent,
  hasModifier,
  isMacOS,
} from '@/lib/shortcuts';
import { useUiStore } from '@/stores/uiStore';
import { DEFAULT_SHORTCUTS, mergeShortcuts } from '../../shared/shortcutDefaults';

const FRONTMATTER_FEATURES = [
  { icon: CheckSquare, label: 'Status management (ToDo, In Progress, Review, Completed)' },
  { icon: Columns, label: 'Kanban board view' },
  { icon: GitBranch, label: 'Dependency graph between plans' },
  { icon: CheckSquare, label: 'Subtasks with progress tracking' },
  { icon: Clock, label: 'Due date tracking with deadline alerts' },
];

const DEFAULT_PLAN_DIRECTORY = '~/.agent-plans/plans';

interface DirectoryEntry {
  id: string;
  path: string;
}

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

function createDirectoryEntry(path = ''): DirectoryEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    path,
  };
}

function toDirectoryEntries(paths: string[] | undefined): DirectoryEntry[] {
  const source = paths && paths.length > 0 ? paths : [DEFAULT_PLAN_DIRECTORY];
  return source.map((path) => createDirectoryEntry(path));
}

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
  const fileWatcherHeadingId = useId();
  const [directoryEntries, setDirectoryEntries] = useState<DirectoryEntry[]>([]);
  const [pickingDirectoryId, setPickingDirectoryId] = useState<string | null>(null);
  const [editingShortcut, setEditingShortcut] = useState<ShortcutAction | null>(null);
  const [localShortcuts, setLocalShortcuts] = useState<AppShortcuts>(DEFAULT_SHORTCUTS);
  const macOS = isMacOS();

  const savedDirectories =
    settings?.planDirectories && settings.planDirectories.length > 0
      ? settings.planDirectories
      : [DEFAULT_PLAN_DIRECTORY];
  const normalizedDirectories = Array.from(
    new Set(directoryEntries.map((entry) => entry.path.trim()).filter(Boolean))
  );
  const hasDirectoryChanges = normalizedDirectories.join('\n') !== savedDirectories.join('\n');

  const currentShortcuts: AppShortcuts = useMemo(
    () => mergeShortcuts(settings?.shortcuts),
    [settings?.shortcuts]
  );

  useEffect(() => {
    if (hasDirectoryChanges && directoryEntries.length > 0) return;

    const directories = settings?.planDirectories ?? [];
    const source = directories.length > 0 ? directories : [DEFAULT_PLAN_DIRECTORY];

    setDirectoryEntries((current) => {
      const currentPaths = current.map((entry) => entry.path);
      const isSame =
        currentPaths.length === source.length &&
        currentPaths.every((path, index) => path === source[index]);

      if (isSame) return current;
      return source.map((path) => createDirectoryEntry(path));
    });
  }, [settings?.planDirectories, hasDirectoryChanges, directoryEntries.length]);

  useEffect(() => {
    setLocalShortcuts((previous) => {
      if (areShortcutsEqual(previous, currentShortcuts)) {
        return previous;
      }
      return currentShortcuts;
    });
  }, [currentShortcuts]);

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

  const handleToggle = async () => {
    const newValue = !settings?.frontmatterEnabled;
    try {
      const updated = await updateSettings.mutateAsync({ frontmatterEnabled: newValue });
      setDirectoryEntries(toDirectoryEntries(updated.planDirectories));
      addToast(
        newValue ? 'Frontmatter features enabled' : 'Frontmatter features disabled',
        'success'
      );
    } catch {
      addToast('Failed to update settings', 'error');
    }
  };

  const handleFileWatcherToggle = async () => {
    const newValue = !settings?.fileWatcherEnabled;
    try {
      await updateSettings.mutateAsync({ fileWatcherEnabled: newValue });
      addToast(newValue ? 'File watcher enabled' : 'File watcher disabled', 'success');
    } catch {
      addToast('Failed to update file watcher setting', 'error');
    }
  };

  const handleDirectoryChange = (id: string, nextValue: string) => {
    setDirectoryEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, path: nextValue } : entry))
    );
  };

  const handleAddDirectory = () => {
    setDirectoryEntries((current) => [...current, createDirectoryEntry('')]);
  };

  const handleRemoveDirectory = (id: string) => {
    setDirectoryEntries((current) => current.filter((entry) => entry.id !== id));
  };

  const handlePickDirectory = async (id: string) => {
    try {
      const currentEntry = directoryEntries.find((entry) => entry.id === id);
      setPickingDirectoryId(id);
      const selectedPath = await ipcClient.settings.selectDirectory(currentEntry?.path);
      if (!selectedPath) return;
      handleDirectoryChange(id, selectedPath);
    } catch {
      addToast('Failed to open directory picker', 'error');
    } finally {
      setPickingDirectoryId(null);
    }
  };

  const handleSaveDirectories = async () => {
    if (normalizedDirectories.length === 0) {
      addToast('At least one directory is required', 'error');
      return;
    }

    try {
      const updated = await updateSettings.mutateAsync({ planDirectories: normalizedDirectories });
      setDirectoryEntries(toDirectoryEntries(updated.planDirectories));
      addToast('Plan directories updated', 'success');
    } catch {
      addToast('Failed to update plan directories', 'error');
    }
  };

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

      <div className="rounded-lg border bg-card p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Plan Directories</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add one or more directories to scan for Markdown plans. The first directory is used
              for new plan creation.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddDirectory}
            className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {directoryEntries.map((entry, index) => (
            <div key={entry.id} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Folder className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={entry.path}
                  onChange={(event) => handleDirectoryChange(entry.id, event.target.value)}
                  placeholder={index === 0 ? '~/.agent-plans/plans' : '/path/to/another/plans'}
                  className="h-10 w-full rounded border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary"
                />
              </div>
              <button
                type="button"
                onClick={() => void handlePickDirectory(entry.id)}
                disabled={pickingDirectoryId === entry.id}
                className="inline-flex h-10 w-10 items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                title="Browse directory"
              >
                <FolderOpen className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleRemoveDirectory(entry.id)}
                disabled={directoryEntries.length <= 1}
                className="inline-flex h-10 w-10 items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                title="Remove directory"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>
          ))}
          {directoryEntries.length === 0 && (
            <p className="rounded border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              No directory configured yet. Add at least one directory.
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Duplicates and empty rows are ignored automatically when saving.
          </p>
          <button
            type="button"
            onClick={handleSaveDirectories}
            disabled={updateSettings.isPending || !hasDirectoryChanges}
            className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            Save Directories
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 id={fileWatcherHeadingId} className="text-lg font-semibold flex items-center gap-2">
              <Eye className="h-5 w-5 text-muted-foreground" />
              File Watcher
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically refresh plans when files are modified by external editors (e.g., Claude
              Code).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-labelledby={fileWatcherHeadingId}
            aria-checked={settings?.fileWatcherEnabled ?? false}
            onClick={handleFileWatcherToggle}
            disabled={updateSettings.isPending}
            className={`
              relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
              transition-colors duration-200 ease-in-out
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              ${settings?.fileWatcherEnabled ? 'bg-primary' : 'bg-muted'}
            `}
          >
            <span
              className={`
                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0
                transition duration-200 ease-in-out
                ${settings?.fileWatcherEnabled ? 'translate-x-5' : 'translate-x-0'}
              `}
            />
          </button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          When enabled, the app watches plan directories for changes and automatically invalidates
          cached data. Disabled by default.
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
