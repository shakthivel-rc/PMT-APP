/**
 * Guards for the theme system.
 *
 * Ten themes means every accessibility question is asked ten times, which is exactly the
 * kind of check a human stops doing by theme four. So the contrast obligations are
 * asserted here instead: WCAG 2.2 requires 4.5:1 for normal text (SC 1.4.3) and 3:1 for
 * UI components and focus indicators (SC 1.4.11), and every theme has to clear both on
 * every surface the token is actually drawn on.
 *
 * These tests read the generated CSS, so they check what the browser will really apply —
 * not the palette data it was derived from. That also makes them the drift detector: edit
 * themes.ts without re-running `npm run themes` and the two disagree here.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEMES, THEME_MODES, getTheme, isThemeId, themesByMode } from './themes';

const CSS = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');
const HTML = readFileSync(resolve(__dirname, '../../../index.html'), 'utf8');

// ---------------------------------------------------------------- colour maths

const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
};

const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** Every custom property declared in a theme's generated block. */
const tokensOf = (themeId: string): Record<string, string> => {
  const selector = themeId === 'light' ? ":root,\n[data-theme='light'] {" : `[data-theme='${themeId}'] {`;
  const start = CSS.indexOf(selector);
  if (start === -1) throw new Error(`No CSS block for theme "${themeId}" — run: npm run themes`);
  const block = CSS.slice(start, CSS.indexOf('\n}', start));
  const tokens: Record<string, string> = {};
  for (const [, key, value] of block.matchAll(/(--[\w-]+|color-scheme):\s*([^;]+);/g)) {
    tokens[key] = value.trim();
  }
  return tokens;
};

/** Token pairs where text sits on a surface — WCAG SC 1.4.3, 4.5:1. */
const TEXT_PAIRS: Array<[string, string]> = [
  ['--foreground', '--background'],
  ['--card-foreground', '--card'],
  ['--popover-foreground', '--popover'],
  ['--primary-foreground', '--primary'],
  ['--secondary-foreground', '--secondary'],
  ['--accent-foreground', '--accent'],
  ['--destructive-foreground', '--destructive'],
  ['--sidebar-foreground', '--sidebar'],
  ['--sidebar-accent-foreground', '--sidebar-accent'],
  ['--sidebar-primary-foreground', '--sidebar-primary'],
  // The most-used secondary text, against all three surfaces it appears on.
  ['--muted-foreground', '--background'],
  ['--muted-foreground', '--card'],
  ['--muted-foreground', '--muted'],
  // Status text is used both on its own tint and directly on a card.
  ['--success', '--success-subtle'],
  ['--success', '--card'],
  ['--warning', '--warning-subtle'],
  ['--warning', '--card'],
  ['--danger', '--danger-subtle'],
  ['--danger', '--card'],
  ['--info', '--info-subtle'],
  ['--info', '--card'],
  // The sidebar draws on its own surface, so its foregrounds have to be checked against it
  // rather than against the page background.
  ['--sidebar-foreground', '--sidebar'],
  ['--sidebar-accent-foreground', '--sidebar'],
  ['--sidebar-accent-foreground', '--sidebar-accent'],
];

/**
 * Non-text contrast — SC 1.4.11, 3:1. Focus indicators are explicitly in scope.
 *
 * `--border` and `--input` are here because every text input and select trigger is
 * `bg-transparent`, so the 1px border is the only thing that says a control exists —
 * exactly the "visual boundary" the criterion is about. They appeared in REQUIRED_TOKENS
 * (so they had to exist) but nothing asserted they were visible, which is how nine of ten
 * themes shipped below 2:1 with a green suite.
 */
const UI_PAIRS: Array<[string, string]> = [
  ['--ring', '--background'],
  ['--ring', '--card'],
  ['--border', '--background'],
  ['--border', '--card'],
  ['--input', '--card'],
];

const REQUIRED_TOKENS = [
  '--background', '--foreground', '--card', '--card-foreground', '--popover', '--popover-foreground',
  '--primary', '--primary-foreground', '--secondary', '--secondary-foreground',
  '--muted', '--muted-foreground', '--accent', '--accent-foreground',
  '--destructive', '--destructive-foreground', '--border', '--input', '--ring',
  '--success', '--success-foreground', '--success-subtle',
  '--warning', '--warning-foreground', '--warning-subtle',
  '--info', '--info-foreground', '--info-subtle',
  '--danger', '--danger-foreground', '--danger-subtle',
  '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
  '--sidebar', '--sidebar-foreground', '--sidebar-primary', '--sidebar-primary-foreground',
  '--sidebar-accent', '--sidebar-accent-foreground', '--sidebar-border', '--sidebar-ring',
  '--shadow-xs', '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-primary',
];

describe('the theme registry', () => {
  it('offers a rich theme selection with a real choice in both schemes', () => {
    expect(THEMES).toHaveLength(20);
    expect(themesByMode('light').length).toBeGreaterThanOrEqual(8);
    expect(themesByMode('dark').length).toBeGreaterThanOrEqual(12);
  });

  it('keeps ids unique and names human', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    for (const theme of THEMES) {
      expect(theme.name.length).toBeGreaterThan(0);
      expect(theme.description.length).toBeGreaterThan(0);
      expect(theme.source.length).toBeGreaterThan(0);
    }
  });

  it('still ships the original light and dark themes, so nobody loses what they had', () => {
    expect(getTheme('light')?.mode).toBe('light');
    expect(getTheme('dark')?.mode).toBe('dark');
  });

  it('recognises only registered ids', () => {
    expect(isThemeId('nord')).toBe(true);
    expect(isThemeId('system')).toBe(false);
    expect(isThemeId('made-up')).toBe(false);
  });
});

describe('generated CSS', () => {
  it.each(THEMES.map((theme) => [theme.id]))('%s declares the whole token contract', (id) => {
    const tokens = tokensOf(id);
    const missing = REQUIRED_TOKENS.filter((token) => !(token in tokens));
    expect(missing, `${id} is missing tokens — a theme that omits shadows looks flat`).toEqual([]);
  });

  it.each(THEMES.map((theme) => [theme.id, theme.mode]))(
    '%s declares color-scheme: %s so native controls match',
    (id, mode) => {
      expect(tokensOf(id)['color-scheme']).toBe(mode);
    },
  );

  it.each(THEMES.map((theme) => [theme.id]))('%s matches its palette in themes.ts', (id) => {
    // Catches editing themes.ts without re-running the generator.
    const theme = getTheme(id)!;
    const tokens = tokensOf(id);
    expect(tokens['--background']).toBe(theme.palette.background);
    expect(tokens['--card']).toBe(theme.palette.surface);
    expect(tokens['--foreground']).toBe(theme.palette.foreground);
    expect(tokens['--primary']).toBe(theme.palette.primary);
  });

  it.each(THEMES.map((theme) => [theme.id]))(
    '%s derives --border from its palette rather than copying it',
    (id) => {
      // `--border` stopped being a pass-through when the generator started walking it to
      // 3:1: nine of ten published palettes declare a border that is invisible against
      // their own background. It must still be *recognisably* that border — a walk that
      // ran away would produce a compliant colour from a different palette — so it is
      // asserted to be either the declared value or a nudged version of it, never
      // unrelated.
      const theme = getTheme(id)!;
      const rendered = tokensOf(id)['--border'];
      expect(rendered).toMatch(/^#[0-9a-f]{6}$/);
      if (contrast(theme.palette.border, theme.palette.background) >= 3) {
        expect(rendered).toBe(theme.palette.border);
      } else {
        expect(rendered).not.toBe(theme.palette.border);
        expect(contrast(rendered, theme.palette.background)).toBeGreaterThanOrEqual(3);
      }
    },
  );
});

describe('WCAG contrast, every theme', () => {
  it.each(THEMES.map((theme) => [theme.id]))('%s: text pairs reach 4.5:1', (id) => {
    const tokens = tokensOf(id);
    const failures = TEXT_PAIRS.map(([fg, bg]) => [fg, bg, contrast(tokens[fg], tokens[bg])] as const)
      .filter(([, , ratio]) => ratio < 4.5)
      .map(([fg, bg, ratio]) => `${fg} on ${bg} = ${ratio.toFixed(2)}`);
    expect(failures).toEqual([]);
  });

  it.each(THEMES.map((theme) => [theme.id]))('%s: focus ring reaches 3:1', (id) => {
    const tokens = tokensOf(id);
    const failures = UI_PAIRS.map(([fg, bg]) => [fg, bg, contrast(tokens[fg], tokens[bg])] as const)
      .filter(([, , ratio]) => ratio < 3)
      .map(([fg, bg, ratio]) => `${fg} on ${bg} = ${ratio.toFixed(2)}`);
    expect(failures).toEqual([]);
  });

  it.each(THEMES.map((theme) => [theme.id]))('%s: status colours stay distinguishable', (id) => {
    const tokens = tokensOf(id);
    // Success and danger carrying the same meaning-by-colour would defeat the point of
    // having four status hues at all.
    expect(contrast(tokens['--success'], tokens['--danger'])).not.toBe(1);
    expect(tokens['--success']).not.toBe(tokens['--danger']);
    expect(tokens['--warning']).not.toBe(tokens['--info']);
  });
});

describe('the pre-paint script', () => {
  it('inlines a scheme map covering every theme', () => {
    // CSS has not parsed when that script runs, so it cannot look polarity up — a theme
    // missing from the map would flash the wrong scheme on every load.
    const match = HTML.match(/var SCHEME = (\{[^;]+\});/);
    expect(match, 'no SCHEME map found in index.html').not.toBeNull();
    const scheme = JSON.parse(match![1]) as Record<string, string>;
    expect(scheme).toEqual(THEME_MODES);
  });

  it('migrates the old two-theme localStorage key', () => {
    expect(HTML).toContain("localStorage.getItem('theme')");
    expect(HTML).toContain("localStorage.getItem('nx-theme')");
  });

  it('writes identity, polarity and color-scheme before first paint', () => {
    expect(HTML).toContain("d.setAttribute('data-theme', id)");
    expect(HTML).toContain("d.classList.toggle('dark'");
    expect(HTML).toContain('d.style.colorScheme');
  });
});
