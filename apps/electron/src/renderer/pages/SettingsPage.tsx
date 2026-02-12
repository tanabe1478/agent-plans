import {
  AlertCircle,
  Bell,
  CheckSquare,
  Clock,
  Columns,
  GitBranch,
  Loader2,
  Signal,
  Tag,
} from 'lucide-react';
import { useSettings, useUpdateSettings } from '@/lib/hooks/useSettings';
import { useUiStore } from '@/stores/uiStore';

const FRONTMATTER_FEATURES = [
  { icon: CheckSquare, label: 'Status management (ToDo, In Progress, Review, Completed)' },
  { icon: Columns, label: 'Kanban board view' },
  { icon: GitBranch, label: 'Dependency graph between plans' },
  { icon: Signal, label: 'Priority levels (Low, Medium, High, Critical)' },
  { icon: Tag, label: 'Tags and bulk tag operations' },
  { icon: CheckSquare, label: 'Subtasks with progress tracking' },
  { icon: Bell, label: 'Notifications for deadlines and blocked plans' },
  { icon: Clock, label: 'Due date tracking with deadline alerts' },
];

export function SettingsPage() {
  const { data: settings, isLoading, error } = useSettings();
  const updateSettings = useUpdateSettings();
  const { addToast } = useUiStore();

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
      await updateSettings.mutateAsync({ frontmatterEnabled: newValue });
      addToast(
        newValue ? 'Frontmatter features enabled' : 'Frontmatter features disabled',
        'success'
      );
    } catch {
      addToast('Failed to update settings', 'error');
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Frontmatter Features</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enable YAML frontmatter-based plan management features. These are custom features
              beyond basic Markdown plans.
            </p>
          </div>
          <button
            type="button"
            role="switch"
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
    </div>
  );
}
