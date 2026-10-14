import { describe, it, expect } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/renderWithProviders';
import CommandPalette from './CommandPalette';
import { useCommandPalette } from './useCommandPalette';

// Component to test keyboard shortcut hook
const ShortcutHarness = () => {
  useCommandPalette();
  return <CommandPalette />;
};

describe('<CommandPalette>', () => {
  it('does not render dialog content when closed', () => {
    renderWithProviders(<CommandPalette />, {
      preloadedState: {
        ui: {
          commandPaletteOpen: false,
          theme: 'light',
          dayTheme: 'light',
          nightTheme: 'dark',
          notifications: [],
          sidebarCollapsed: false,
          treeCollapsed: false,
          focusMode: false,
          ticketViewMode: 'drawer',
          chatDrawerOpen: false,
        },
      } as never,
    });

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('renders input and groups when open', () => {
    renderWithProviders(<CommandPalette />, {
      preloadedState: {
        ui: {
          commandPaletteOpen: true,
          theme: 'light',
          dayTheme: 'light',
          nightTheme: 'dark',
          notifications: [],
          sidebarCollapsed: false,
          treeCollapsed: false,
          focusMode: false,
          ticketViewMode: 'drawer',
          chatDrawerOpen: false,
        },
      } as never,
    });

    expect(screen.getByRole('combobox', { name: /search/i })).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
  });

  it('filters actions when query is entered', async () => {
    renderWithProviders(<CommandPalette />, {
      preloadedState: {
        ui: {
          commandPaletteOpen: true,
          theme: 'light',
          dayTheme: 'light',
          nightTheme: 'dark',
          notifications: [],
          sidebarCollapsed: false,
          treeCollapsed: false,
          focusMode: false,
          ticketViewMode: 'drawer',
          chatDrawerOpen: false,
        },
      } as never,
    });

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Focus' } });

    expect(screen.getByText('Enter Focus Mode')).toBeInTheDocument();
    expect(screen.queryByText('Timesheet & Financial Time Tracking')).not.toBeInTheDocument();
  });

  it('opens palette when Cmd+K or Ctrl+K is pressed', async () => {
    const { store } = renderWithProviders(<ShortcutHarness />, {
      preloadedState: {
        ui: {
          commandPaletteOpen: false,
          theme: 'light',
          dayTheme: 'light',
          nightTheme: 'dark',
          notifications: [],
          sidebarCollapsed: false,
          treeCollapsed: false,
          focusMode: false,
          ticketViewMode: 'drawer',
          chatDrawerOpen: false,
        },
      } as never,
    });

    expect(store.getState().ui.commandPaletteOpen).toBe(false);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(store.getState().ui.commandPaletteOpen).toBe(true);
  });
});
