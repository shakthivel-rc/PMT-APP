import { beforeEach, describe, expect, it } from 'vitest';
import {
  DAY_THEME_KEY,
  LEGACY_THEME_KEY,
  NIGHT_THEME_KEY,
  THEME_KEY,
  applyTheme,
  loadThemeSelection,
  persistThemeSelection,
  resolveTheme,
} from './theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
});

describe('resolveTheme', () => {
  const selection = { preference: 'system', dayTheme: 'solarized-light', nightTheme: 'nord' };

  it('returns a named preference as-is', () => {
    expect(resolveTheme({ ...selection, preference: 'dracula' }, true)).toBe('dracula');
    expect(resolveTheme({ ...selection, preference: 'dracula' }, false)).toBe('dracula');
  });

  it('picks the day or night theme when following the system', () => {
    expect(resolveTheme(selection, false)).toBe('solarized-light');
    expect(resolveTheme(selection, true)).toBe('nord');
  });

  it('falls back to the stock pair when a stored id is no longer registered', () => {
    // A theme could be removed in a later release; a stale id must not blank the app.
    const stale = { preference: 'system', dayTheme: 'retired-theme', nightTheme: 'retired-theme' };
    expect(resolveTheme(stale, false)).toBe('light');
    expect(resolveTheme(stale, true)).toBe('dark');
  });

  it('ignores an unknown explicit preference rather than applying it', () => {
    expect(resolveTheme({ ...selection, preference: 'nonsense' }, true)).toBe('nord');
  });
});

describe('applyTheme', () => {
  it('writes identity, polarity and color-scheme together', () => {
    applyTheme('nord');
    const root = document.documentElement;
    expect(root.dataset.theme).toBe('nord');
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
  });

  it('drops the dark class for a light theme', () => {
    applyTheme('nord');
    applyTheme('solarized-light');
    const root = document.documentElement;
    expect(root.dataset.theme).toBe('solarized-light');
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
  });

  it('switching themes never leaves the previous one behind', () => {
    // The reason identity is an attribute rather than a class: an attribute cannot hold
    // two values, so there is no stale-class cleanup to forget.
    applyTheme('dracula');
    applyTheme('gruvbox-dark');
    expect(document.documentElement.dataset.theme).toBe('gruvbox-dark');
  });
});

describe('loadThemeSelection', () => {
  it('defaults to following the system', () => {
    expect(loadThemeSelection()).toEqual({
      preference: 'system',
      dayTheme: 'light',
      nightTheme: 'dark',
    });
  });

  it('migrates a user who had chosen dark under the old two-theme setting', () => {
    localStorage.setItem(LEGACY_THEME_KEY, 'dark');
    expect(loadThemeSelection().preference).toBe('dark');
  });

  it('migrates a user who had chosen light', () => {
    localStorage.setItem(LEGACY_THEME_KEY, 'light');
    expect(loadThemeSelection().preference).toBe('light');
  });

  it('prefers the new key once it exists', () => {
    localStorage.setItem(LEGACY_THEME_KEY, 'dark');
    localStorage.setItem(THEME_KEY, 'nord');
    expect(loadThemeSelection().preference).toBe('nord');
  });

  it('restores a stored day/night pair', () => {
    localStorage.setItem(DAY_THEME_KEY, 'catppuccin-latte');
    localStorage.setItem(NIGHT_THEME_KEY, 'catppuccin-mocha');
    expect(loadThemeSelection()).toMatchObject({
      dayTheme: 'catppuccin-latte',
      nightTheme: 'catppuccin-mocha',
    });
  });

  it('ignores a corrupt stored value instead of applying it', () => {
    localStorage.setItem(THEME_KEY, '{{not-a-theme}}');
    localStorage.setItem(DAY_THEME_KEY, 'deleted-theme');
    expect(loadThemeSelection()).toMatchObject({ preference: 'system', dayTheme: 'light' });
  });
});

describe('persistThemeSelection', () => {
  it('writes only the fields it was given', () => {
    persistThemeSelection({ preference: 'nord' });
    expect(localStorage.getItem(THEME_KEY)).toBe('nord');
    expect(localStorage.getItem(DAY_THEME_KEY)).toBeNull();

    persistThemeSelection({ dayTheme: 'solarized-light' });
    expect(localStorage.getItem(THEME_KEY)).toBe('nord');
    expect(localStorage.getItem(DAY_THEME_KEY)).toBe('solarized-light');
  });
});
