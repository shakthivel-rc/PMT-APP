import { describe, it, expect } from 'vitest';
import type { RootState } from '@/app/store';
import { renderWithProviders, screen, userEvent } from '@/test/renderWithProviders';
import ThemeToggle from '@/components/ThemeToggle';

const uiState = (theme: string, over: Partial<{ dayTheme: string; nightTheme: string }> = {}) =>
  ({
    ui: {
      theme,
      dayTheme: 'light',
      nightTheme: 'dark',
      notifications: [],
      sidebarCollapsed: false,
      treeCollapsed: false,
      focusMode: false,
      ticketViewMode: 'drawer',
      chatDrawerOpen: false,
      commandPaletteOpen: false,
      ...over,
    },
  }) as Partial<RootState>;

describe('<ThemeToggle>', () => {
  it('labels itself by the theme it will switch to', () => {
    renderWithProviders(<ThemeToggle />, { preloadedState: uiState('dark') });
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('dispatches toggleTheme and flips the store + label on click', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<ThemeToggle />, { preloadedState: uiState('dark') });

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));

    expect(store.getState().ui.theme).toBe('light');
    expect(localStorage.getItem('nx-theme')).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });

  it('reads polarity from the theme registry, not from the id', () => {
    // Nord is a dark theme whose id says nothing about its scheme — the button still has
    // to offer the light direction.
    renderWithProviders(<ThemeToggle />, { preloadedState: uiState('nord') });
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('resolves the system preference through the day/night pair', () => {
    renderWithProviders(<ThemeToggle />, {
      preloadedState: uiState('system', { dayTheme: 'solarized-light', nightTheme: 'dracula' }),
    });
    // jsdom reports no dark preference, so the day theme (a light one) is in force.
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });

  it('offers every theme plus system behind the menu', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />, { preloadedState: uiState('dark') });

    await user.click(screen.getByRole('button', { name: 'Choose a theme' }));
    expect(screen.getByRole('menuitem', { name: /Sync with system/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Nord' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Solarized Light' })).toBeInTheDocument();
  });

  it('selects a named theme from the menu', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<ThemeToggle />, { preloadedState: uiState('dark') });

    await user.click(screen.getByRole('button', { name: 'Choose a theme' }));
    await user.click(screen.getByRole('menuitem', { name: 'Gruvbox Dark' }));

    expect(store.getState().ui.theme).toBe('gruvbox-dark');
    expect(localStorage.getItem('nx-theme')).toBe('gruvbox-dark');
  });
});
