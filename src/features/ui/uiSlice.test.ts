import { describe, it, expect, beforeEach } from 'vitest';
import uiReducer, {
  addNotification,
  removeNotification,
  setDayTheme,
  setNightTheme,
  setTheme,
  toggleTheme,
  toggleSidebar,
  toggleTree,
  toggleFocusMode,
  setTicketViewMode,
  setQuickCreateOpen,
  toggleQuickCreate,
  setShortcutsCheatsheetOpen,
  toggleShortcutsCheatsheet,
  type Notification,
  type UiState,
} from '@/features/ui/uiSlice';

// Importing this slice at all reads localStorage and window.matchMedia at module scope,
// so this test also proves the setup.ts polyfill is installed before slice import.
const baseState = (over: Partial<UiState> = {}): UiState => ({
  theme: 'dark' as string,
  dayTheme: 'light',
  nightTheme: 'dark',
  notifications: [] as Notification[],
  sidebarCollapsed: false,
  treeCollapsed: false,
  focusMode: false,
  ticketViewMode: 'drawer',
  chatDrawerOpen: false,
  commandPaletteOpen: false,
  quickCreateOpen: false,
  shortcutsCheatsheetOpen: false,
  ...over,
});

describe('uiSlice theme reducers', () => {
  beforeEach(() => localStorage.clear());

  it('toggleTheme flips between the chosen light and dark themes', () => {
    const next = uiReducer(baseState({ theme: 'dark' }), toggleTheme());
    expect(next.theme).toBe('light');
    expect(localStorage.getItem('nx-theme')).toBe('light');

    const back = uiReducer(next, toggleTheme());
    expect(back.theme).toBe('dark');
    expect(localStorage.getItem('nx-theme')).toBe('dark');
  });

  it('toggleTheme respects a custom light/dark pair rather than snapping to the defaults', () => {
    // Someone using Nord who hits the header toggle should land on THEIR light theme.
    const start = baseState({ theme: 'nord', dayTheme: 'solarized-light', nightTheme: 'nord' });
    const next = uiReducer(start, toggleTheme());
    expect(next.theme).toBe('solarized-light');
    expect(uiReducer(next, toggleTheme()).theme).toBe('nord');
  });

  it('setTheme sets an explicit theme and persists it', () => {
    const next = uiReducer(baseState({ theme: 'dark' }), setTheme('gruvbox-dark'));
    expect(next.theme).toBe('gruvbox-dark');
    expect(localStorage.getItem('nx-theme')).toBe('gruvbox-dark');
  });

  it('setTheme accepts system, which is resolved against the OS at apply time', () => {
    const next = uiReducer(baseState(), setTheme('system'));
    expect(next.theme).toBe('system');
    expect(localStorage.getItem('nx-theme')).toBe('system');
  });

  it('the day and night themes persist independently', () => {
    let state = uiReducer(baseState(), setDayTheme('catppuccin-latte'));
    state = uiReducer(state, setNightTheme('dracula'));
    expect(state.dayTheme).toBe('catppuccin-latte');
    expect(state.nightTheme).toBe('dracula');
    expect(localStorage.getItem('nx-theme-day')).toBe('catppuccin-latte');
    expect(localStorage.getItem('nx-theme-night')).toBe('dracula');
  });
});

describe('uiSlice notifications', () => {
  it('addNotification appends with a generated string id, preserving type + message', () => {
    const next = uiReducer(baseState(), addNotification({ type: 'success', message: 'Saved' }));
    expect(next.notifications).toHaveLength(1);
    expect(next.notifications[0]).toMatchObject({ type: 'success', message: 'Saved' });
    expect(typeof next.notifications[0].id).toBe('string');
    expect(next.notifications[0].id.length).toBeGreaterThan(0);
  });

  it('removeNotification drops only the matching id', () => {
    const start = baseState({
      notifications: [
        { id: 'a', type: 'info', message: 'one' },
        { id: 'b', type: 'error', message: 'two' },
      ],
    });
    const next = uiReducer(start, removeNotification('a'));
    expect(next.notifications.map((n) => n.id)).toEqual(['b']);
  });

  it('removeNotification is a no-op for an unknown id', () => {
    const start = baseState({ notifications: [{ id: 'a', type: 'info', message: 'one' }] });
    const next = uiReducer(start, removeNotification('zzz'));
    expect(next.notifications).toHaveLength(1);
  });
});

describe('uiSlice layout reducers', () => {
  beforeEach(() => localStorage.clear());

  it('toggleSidebar flips collapsed state and persists preference', () => {
    const s1 = uiReducer(baseState(), toggleSidebar());
    expect(s1.sidebarCollapsed).toBe(true);

    const s2 = uiReducer(s1, toggleSidebar());
    expect(s2.sidebarCollapsed).toBe(false);
  });

  it('toggleTree flips hierarchy tree collapsed state', () => {
    const s1 = uiReducer(baseState(), toggleTree());
    expect(s1.treeCollapsed).toBe(true);

    const s2 = uiReducer(s1, toggleTree());
    expect(s2.treeCollapsed).toBe(false);
  });

  it('toggleFocusMode flips focusMode without persisting to localStorage', () => {
    const s1 = uiReducer(baseState(), toggleFocusMode());
    expect(s1.focusMode).toBe(true);

    const s2 = uiReducer(s1, toggleFocusMode());
    expect(s2.focusMode).toBe(false);
  });

  it('setTicketViewMode sets and persists ticket inspection mode', () => {
    const s1 = uiReducer(baseState(), setTicketViewMode('split'));
    expect(s1.ticketViewMode).toBe('split');
  });

  it('manages quickCreateOpen and shortcutsCheatsheetOpen states', () => {
    const s1 = uiReducer(baseState(), toggleQuickCreate());
    expect(s1.quickCreateOpen).toBe(true);

    const s2 = uiReducer(s1, setQuickCreateOpen(false));
    expect(s2.quickCreateOpen).toBe(false);

    const s3 = uiReducer(baseState(), toggleShortcutsCheatsheet());
    expect(s3.shortcutsCheatsheetOpen).toBe(true);

    const s4 = uiReducer(s3, setShortcutsCheatsheetOpen(false));
    expect(s4.shortcutsCheatsheetOpen).toBe(false);
  });
});
