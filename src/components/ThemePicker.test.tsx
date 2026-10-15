import { describe, expect, it } from 'vitest';
import type { RootState } from '@/app/store';
import { renderWithProviders, screen, userEvent } from '@/test/renderWithProviders';
import ThemePicker from '@/components/ThemePicker';

const uiState = (over: Partial<{ theme: string; dayTheme: string; nightTheme: string }> = {}) =>
  ({
    ui: {
      theme: 'light',
      dayTheme: 'light',
      nightTheme: 'dark',
      notifications: [],
      sidebarCollapsed: false,
      treeCollapsed: false,
      focusMode: false,
      ticketViewMode: 'drawer',
      chatDrawerOpen: false,
      commandPaletteOpen: false,
      quickCreateOpen: false,
      shortcutsCheatsheetOpen: false,
      ...over,
    },
  }) as Partial<RootState>;

describe('<ThemePicker>', () => {
  it('groups themes by scheme so the list stays scannable', () => {
    renderWithProviders(<ThemePicker />, { preloadedState: uiState() });
    expect(screen.getByRole('radiogroup', { name: 'light themes' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'dark themes' })).toBeInTheDocument();
  });

  it('shows every theme with its description', () => {
    renderWithProviders(<ThemePicker />, { preloadedState: uiState() });
    expect(screen.getByRole('radio', { name: /Nord/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Solarized Light/ })).toBeInTheDocument();
    expect(screen.getByText(/True black for OLED/)).toBeInTheDocument();
  });

  it('marks the active theme', () => {
    renderWithProviders(<ThemePicker />, { preloadedState: uiState({ theme: 'dracula' }) });
    expect(screen.getByRole('radio', { name: /Dracula/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Nord/ })).not.toBeChecked();
  });

  it('applies a theme on selection', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<ThemePicker />, { preloadedState: uiState() });

    await user.click(screen.getByRole('radio', { name: /Gruvbox Dark/ }));

    expect(store.getState().ui.theme).toBe('gruvbox-dark');
    expect(document.documentElement.dataset.theme).toBe('gruvbox-dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('previews on hover without committing the change', async () => {
    // Browsing must not become choosing: a hover paints the whole page so the theme can
    // be judged in situ, but a pointer that wanders away must leave the selection intact.
    const user = userEvent.setup();
    const { store } = renderWithProviders(<ThemePicker />, { preloadedState: uiState() });

    await user.hover(screen.getByRole('radio', { name: /Nord/ }));
    expect(document.documentElement.dataset.theme).toBe('nord');
    expect(store.getState().ui.theme).toBe('light');

    await user.unhover(screen.getByRole('radio', { name: /Nord/ }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(store.getState().ui.theme).toBe('light');
  });

  it('hides the day/night pair until the user follows the system', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemePicker />, { preloadedState: uiState() });

    expect(screen.queryByLabelText('Day theme')).toBeNull();
    await user.click(screen.getByRole('radio', { name: /Sync with system/ }));
    expect(screen.getByLabelText('Day theme')).toBeInTheDocument();
    expect(screen.getByLabelText('Night theme')).toBeInTheDocument();
  });

  it('records the system preference', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<ThemePicker />, { preloadedState: uiState() });

    await user.click(screen.getByRole('radio', { name: /Sync with system/ }));
    expect(store.getState().ui.theme).toBe('system');
    expect(localStorage.getItem('nx-theme')).toBe('system');
  });
});
