import {
  DEFAULT_DAY_THEME,
  DEFAULT_NIGHT_THEME,
  SYSTEM_THEME,
  THEME_MODES,
  isThemeId,
  type ThemePreference,
} from '@/features/ui/themes';

/**
 * Theme resolution and DOM application.
 *
 * Two separate concerns, deliberately: `data-theme` on <html> carries the palette
 * *identity*, and the `.dark` class carries only the scheme *polarity*. Keeping the class
 * means every `dark:` utility already written across the app keeps working however many
 * themes exist — adding a theme never touches a component.
 */

export const THEME_KEY = 'nx-theme';
export const DAY_THEME_KEY = 'nx-theme-day';
export const NIGHT_THEME_KEY = 'nx-theme-night';
/** Pre-existing key from when the app had exactly two themes. */
export const LEGACY_THEME_KEY = 'theme';

export interface ThemeSelection {
  preference: ThemePreference;
  dayTheme: string;
  nightTheme: string;
}

const prefersDark = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

/** The theme id actually in force, collapsing 'system' against the OS setting. */
export const resolveTheme = (selection: ThemeSelection, dark = prefersDark()): string => {
  const { preference, dayTheme, nightTheme } = selection;
  if (preference !== SYSTEM_THEME && isThemeId(preference)) return preference;
  const chosen = dark ? nightTheme : dayTheme;
  return isThemeId(chosen) ? chosen : dark ? DEFAULT_NIGHT_THEME : DEFAULT_DAY_THEME;
};

/** Writes identity, polarity and color-scheme in one place. */
export const applyTheme = (themeId: string): void => {
  if (typeof document === 'undefined') return;
  const mode = THEME_MODES[themeId] ?? 'light';
  const root = document.documentElement;
  root.dataset.theme = themeId;
  root.classList.toggle('dark', mode === 'dark');
  // Tells the browser — not our CSS — how to paint scrollbars, native form controls and
  // the canvas. Without it a dark theme still gets a white select dropdown.
  root.style.colorScheme = mode;
};

const readStoredTheme = (key: string, fallback: string): string => {
  try {
    const stored = localStorage.getItem(key);
    return isThemeId(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Loads the persisted selection, migrating the two-theme `theme` key.
 *
 * Users who set light or dark before this shipped keep exactly what they had; anyone with
 * no preference at all follows the OS.
 */
export const loadThemeSelection = (): ThemeSelection => {
  let preference: ThemePreference = SYSTEM_THEME;
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === SYSTEM_THEME || isThemeId(stored)) {
      preference = stored;
    } else {
      const legacy = localStorage.getItem(LEGACY_THEME_KEY);
      preference = legacy === 'light' || legacy === 'dark' ? legacy : SYSTEM_THEME;
    }
  } catch {
    preference = SYSTEM_THEME;
  }

  return {
    preference,
    dayTheme: readStoredTheme(DAY_THEME_KEY, DEFAULT_DAY_THEME),
    nightTheme: readStoredTheme(NIGHT_THEME_KEY, DEFAULT_NIGHT_THEME),
  };
};

export const persistThemeSelection = (selection: Partial<ThemeSelection>): void => {
  try {
    if (selection.preference !== undefined) localStorage.setItem(THEME_KEY, selection.preference);
    if (selection.dayTheme !== undefined) localStorage.setItem(DAY_THEME_KEY, selection.dayTheme);
    if (selection.nightTheme !== undefined) localStorage.setItem(NIGHT_THEME_KEY, selection.nightTheme);
  } catch {
    // Private browsing or a full quota — the theme still applies for this session.
  }
};
