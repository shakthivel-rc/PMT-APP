import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SYSTEM_THEME, THEME_MODES, type ThemePreference } from './themes';
import { loadThemeSelection, persistThemeSelection } from '@/lib/theme';

/** Kept as an alias so existing imports of `Theme` still compile. */
export type Theme = ThemePreference;

export type TicketViewMode = 'drawer' | 'split' | 'modal';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface LayoutPreferences {
  sidebarCollapsed: boolean;
  treeCollapsed: boolean;
  ticketViewMode: TicketViewMode;
}

const LAYOUT_STORAGE_KEY = 'nx-layout';

function loadLayoutPreferences(): LayoutPreferences {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LAYOUT_STORAGE_KEY) : null;
    if (!raw) return { sidebarCollapsed: false, treeCollapsed: false, ticketViewMode: 'drawer' };
    const parsed = JSON.parse(raw);
    return {
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
      treeCollapsed: Boolean(parsed.treeCollapsed),
      ticketViewMode: ['drawer', 'split', 'modal'].includes(parsed.ticketViewMode)
        ? parsed.ticketViewMode
        : 'drawer',
    };
  } catch {
    return { sidebarCollapsed: false, treeCollapsed: false, ticketViewMode: 'drawer' };
  }
}

function persistLayoutPreferences(prefs: LayoutPreferences) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(prefs));
    }
  } catch {
    // Ignore storage issues
  }
}

export interface UiState {
  /** A theme id, or 'system' to follow the OS via the day/night pair below. */
  theme: ThemePreference;
  /** Used only while `theme` is 'system'. */
  dayTheme: string;
  nightTheme: string;
  notifications: Notification[];
  sidebarCollapsed: boolean;
  treeCollapsed: boolean;
  focusMode: boolean;
  ticketViewMode: TicketViewMode;
  chatDrawerOpen: boolean;
}

const stored = loadThemeSelection();
const storedLayout = loadLayoutPreferences();

const initialState: UiState = {
  theme: stored.preference,
  dayTheme: stored.dayTheme,
  nightTheme: stored.nightTheme,
  notifications: [],
  sidebarCollapsed: storedLayout.sidebarCollapsed,
  treeCollapsed: storedLayout.treeCollapsed,
  focusMode: false,
  ticketViewMode: storedLayout.ticketViewMode,
  chatDrawerOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    /**
     * The one-click path in the header: flip between the light and dark ends of whatever
     * the user is currently using, rather than always snapping back to the stock pair.
     */
    toggleTheme: (state) => {
      const resolved = state.theme === SYSTEM_THEME ? state.dayTheme : state.theme;
      const isDark = THEME_MODES[resolved] === 'dark';
      state.theme = isDark ? state.dayTheme : state.nightTheme;
      persistThemeSelection({ preference: state.theme });
    },
    setTheme: (state, action: PayloadAction<ThemePreference>) => {
      state.theme = action.payload;
      persistThemeSelection({ preference: state.theme });
    },
    setDayTheme: (state, action: PayloadAction<string>) => {
      state.dayTheme = action.payload;
      persistThemeSelection({ dayTheme: state.dayTheme });
    },
    setNightTheme: (state, action: PayloadAction<string>) => {
      state.nightTheme = action.payload;
      persistThemeSelection({ nightTheme: state.nightTheme });
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id'>>) => {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      state.notifications.push({ ...action.payload, id });
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter((n) => n.id !== action.payload);
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      persistLayoutPreferences({
        sidebarCollapsed: state.sidebarCollapsed,
        treeCollapsed: state.treeCollapsed,
        ticketViewMode: state.ticketViewMode,
      });
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
      persistLayoutPreferences({
        sidebarCollapsed: state.sidebarCollapsed,
        treeCollapsed: state.treeCollapsed,
        ticketViewMode: state.ticketViewMode,
      });
    },
    toggleTree: (state) => {
      state.treeCollapsed = !state.treeCollapsed;
      persistLayoutPreferences({
        sidebarCollapsed: state.sidebarCollapsed,
        treeCollapsed: state.treeCollapsed,
        ticketViewMode: state.ticketViewMode,
      });
    },
    setTreeCollapsed: (state, action: PayloadAction<boolean>) => {
      state.treeCollapsed = action.payload;
      persistLayoutPreferences({
        sidebarCollapsed: state.sidebarCollapsed,
        treeCollapsed: state.treeCollapsed,
        ticketViewMode: state.ticketViewMode,
      });
    },
    toggleFocusMode: (state) => {
      state.focusMode = !state.focusMode;
    },
    setFocusMode: (state, action: PayloadAction<boolean>) => {
      state.focusMode = action.payload;
    },
    setTicketViewMode: (state, action: PayloadAction<TicketViewMode>) => {
      state.ticketViewMode = action.payload;
      persistLayoutPreferences({
        sidebarCollapsed: state.sidebarCollapsed,
        treeCollapsed: state.treeCollapsed,
        ticketViewMode: state.ticketViewMode,
      });
    },
    toggleChatDrawer: (state) => {
      state.chatDrawerOpen = !state.chatDrawerOpen;
    },
    setChatDrawerOpen: (state, action: PayloadAction<boolean>) => {
      state.chatDrawerOpen = action.payload;
    },
  },
});

export const {
  toggleTheme,
  setTheme,
  setDayTheme,
  setNightTheme,
  addNotification,
  removeNotification,
  toggleSidebar,
  setSidebarCollapsed,
  toggleTree,
  setTreeCollapsed,
  toggleFocusMode,
  setFocusMode,
  setTicketViewMode,
  toggleChatDrawer,
  setChatDrawerOpen,
} = uiSlice.actions;
export default uiSlice.reducer;
