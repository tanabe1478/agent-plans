import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHORTCUTS } from '../../../shared/shortcutDefaults';

const defaultSettings = {
  planDirectories: ['~/.agent-plans/plans'],
  codexIntegrationEnabled: false,
  codexSessionLogDirectories: ['~/.codex/sessions'],
  shortcuts: DEFAULT_SHORTCUTS,
  themeMode: 'system',
  customStylesheetPath: null,
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
    setTheme: vi.fn(),
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

  it('should display appearance section', () => {
    const { container } = render(<SettingsPage />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Appearance').length).toBeGreaterThan(0);
    expect(container.querySelector('#theme-mode')).not.toBeNull();
    expect(container.querySelector('#custom-stylesheet')).not.toBeNull();
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

  it('should save appearance settings', async () => {
    const { container } = render(<SettingsPage />, { wrapper: createWrapper() });
    const view = within(container);
    const themeModeSelect = container.querySelector('#theme-mode') as HTMLSelectElement | null;
    const stylesheetInput = container.querySelector(
      '#custom-stylesheet'
    ) as HTMLInputElement | null;
    const saveButton = view.getByRole('button', { name: 'Save Appearance' });

    if (!themeModeSelect) {
      throw new Error('Theme mode select was not found');
    }
    if (!stylesheetInput) {
      throw new Error('Custom stylesheet input was not found');
    }

    fireEvent.change(themeModeSelect, { target: { value: 'dark' } });
    fireEvent.change(stylesheetInput, { target: { value: '' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        themeMode: 'dark',
        customStylesheetPath: null,
      });
    });
  });
});
