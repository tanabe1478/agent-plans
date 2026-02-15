import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHORTCUTS } from '../../../shared/shortcutDefaults';

const defaultSettings = {
  frontmatterEnabled: false,
  planDirectories: ['~/.agent-plans/plans'],
  codexIntegrationEnabled: false,
  codexSessionLogDirectories: ['~/.codex/sessions'],
  shortcuts: DEFAULT_SHORTCUTS,
};

let currentSettings = { ...defaultSettings };
const mockMutateAsync = vi.fn(async (partial: Record<string, unknown>) => {
  currentSettings = {
    ...currentSettings,
    ...partial,
  };
  return currentSettings;
});

vi.mock('@/lib/hooks/useSettings', () => ({
  useSettings: () => ({
    data: currentSettings,
    isLoading: false,
    error: null,
  }),
  useUpdateSettings: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/stores/uiStore', () => ({
  useUiStore: () => ({
    addToast: vi.fn(),
  }),
}));

import { SettingsPage } from '../SettingsPage';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe('SettingsPage', () => {
  beforeEach(() => {
    currentSettings = { ...defaultSettings };
    mockMutateAsync.mockClear();
  });

  it('should render without crashing', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
  });

  it('should display frontmatter features section', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Frontmatter Features').length).toBeGreaterThan(0);
  });

  it('should have toggle switch', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });
    expect(screen.getAllByRole('switch', { name: /frontmatter features/i }).length).toBeGreaterThan(
      0
    );
  });

  it('should show feature list', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });
    expect(screen.getAllByText(/Status management/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kanban board view/).length).toBeGreaterThan(0);
  });

  it('should display plan directories section', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Plan Directories').length).toBeGreaterThan(0);
  });

  it('should display keyboard shortcuts section', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Keyboard Shortcuts').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Command Palette').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Quick Open').length).toBeGreaterThan(0);
  });

  it('should display codex integration section', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Codex Integration').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Session Log Directories').length).toBeGreaterThan(0);
  });

  it('should keep a newly added empty plan directory row', async () => {
    const { container } = render(<SettingsPage />, { wrapper: createWrapper() });
    const view = within(container);
    const [addPlanDirectoryButton] = view.getAllByRole('button', { name: 'Add' });

    fireEvent.click(addPlanDirectoryButton);

    await waitFor(() => {
      expect(view.getByPlaceholderText('/path/to/another/plans')).not.toBeNull();
    });
  });

  it('should enable save when a second plan directory is entered and persist both', async () => {
    const { container } = render(<SettingsPage />, { wrapper: createWrapper() });
    const view = within(container);
    const [addPlanDirectoryButton] = view.getAllByRole('button', { name: 'Add' });
    const saveDirectoriesButton = view.getByRole('button', { name: 'Save Directories' });

    expect((saveDirectoriesButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(addPlanDirectoryButton);
    const secondDirectoryInput = await view.findByPlaceholderText('/path/to/another/plans');
    fireEvent.change(secondDirectoryInput, { target: { value: '/tmp/another-plans' } });

    expect((saveDirectoriesButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(saveDirectoriesButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        planDirectories: ['~/.agent-plans/plans', '/tmp/another-plans'],
      });
    });
  });

  it('should enable save for codex directories when a second directory is entered', async () => {
    const { container } = render(<SettingsPage />, { wrapper: createWrapper() });
    const view = within(container);
    const [, addCodexDirectoryButton] = view.getAllByRole('button', { name: 'Add' });
    const saveLogDirectoriesButton = view.getByRole('button', { name: 'Save Log Directories' });

    expect((saveLogDirectoriesButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(addCodexDirectoryButton);
    const codexInputs = view.getAllByPlaceholderText('~/.codex/sessions');
    fireEvent.change(codexInputs[1], { target: { value: '/tmp/codex/sessions' } });

    expect((saveLogDirectoriesButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(saveLogDirectoriesButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        codexSessionLogDirectories: ['~/.codex/sessions', '/tmp/codex/sessions'],
      });
    });
  });
});
