/**
 * The theme registry — the single source of truth for every palette.
 *
 * Each entry carries only the ~20 values a palette actually decides; the remaining ~30
 * design tokens (status foregrounds, subtle fills, sidebar, shadows) are derived from these
 * by `scripts/generate-theme-css.mjs`, which emits the CSS blocks in `src/index.css`.
 * Deriving rather than hand-authoring is what keeps ten themes honest: a `-subtle` fill is
 * always mixed from its own accent, and a status foreground is always whichever of
 * black/white actually passes contrast on that accent.
 *
 * Hex values for the named themes are taken verbatim from each project's own published
 * specification (see `source`), not approximated. `themes.test.ts` re-checks that the CSS
 * in index.css still matches this file, so the two can never drift.
 */

export type ThemeMode = 'light' | 'dark';

export interface ThemePalette {
  /** Page backdrop. */
  background: string;
  /** Raised surface — cards, popovers, dialogs. */
  surface: string;
  /** Secondary fill — hover states, muted blocks, badges. */
  surfaceAlt: string;
  /** Body text. */
  foreground: string;
  /** Secondary text. Must still reach 4.5:1 on background, surface and surfaceAlt. */
  mutedForeground: string;
  /** Dividers and card outlines. */
  border: string;
  /** Input outlines — usually a touch stronger than border. */
  input: string;
  /** Brand accent: primary buttons, active nav, links. */
  primary: string;
  /** Focus ring. */
  ring: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  /** Sidebar backdrop — often equal to surface. */
  sidebar: string;
  /** The rgb triple shadows are tinted with, e.g. '15, 23, 42'. */
  shadowRgb: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  mode: ThemeMode;
  /** One line shown under the name in the picker. */
  description: string;
  /** Where the palette came from, so the values stay auditable. */
  source: string;
  palette: ThemePalette;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'light',
    name: 'Light',
    mode: 'light',
    description: 'The Base Project default — cool slate neutrals with a blue accent.',
    source: 'Base Project design language',
    palette: {
      background: '#f1f5f9',
      surface: '#ffffff',
      surfaceAlt: '#e2e8f0',
      foreground: '#0f172a',
      mutedForeground: '#475569',
      border: '#e2e8f0',
      input: '#cbd5e1',
      primary: '#2563eb',
      ring: '#3b82f6',
      success: '#059669',
      warning: '#b45309',
      danger: '#dc2626',
      info: '#0284c7',
      sidebar: '#ffffff',
      shadowRgb: '15, 23, 42',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    mode: 'dark',
    description: 'The Base Project default in dark — deep slate with a brighter blue.',
    source: 'Base Project design language',
    palette: {
      background: '#0f172a',
      surface: '#1e293b',
      surfaceAlt: '#334155',
      foreground: '#f8fafc',
      mutedForeground: '#94a3b8',
      border: '#334155',
      input: '#334155',
      primary: '#3b82f6',
      ring: '#60a5fa',
      success: '#34d399',
      warning: '#fbbf24',
      danger: '#f87171',
      info: '#38bdf8',
      sidebar: '#1e293b',
      shadowRgb: '0, 0, 0',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    mode: 'dark',
    description: 'True black for OLED screens and dark rooms — maximum contrast, minimum glow.',
    source: 'Base Project design language (OLED variant)',
    palette: {
      background: '#000000',
      surface: '#0b0f17',
      surfaceAlt: '#1b2432',
      foreground: '#f8fafc',
      mutedForeground: '#9aa7b8',
      border: '#232d3d',
      input: '#2b3648',
      primary: '#60a5fa',
      ring: '#93c5fd',
      success: '#34d399',
      warning: '#fbbf24',
      danger: '#f87171',
      info: '#38bdf8',
      sidebar: '#05080d',
      shadowRgb: '0, 0, 0',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    mode: 'dark',
    description: 'Arctic blue-grey. Low chroma and easy on the eyes for long sessions.',
    source: 'https://www.nordtheme.com/docs/colors-and-palettes',
    palette: {
      background: '#2e3440',
      surface: '#3b4252',
      surfaceAlt: '#434c5e',
      foreground: '#eceff4',
      mutedForeground: '#d8dee9',
      border: '#4c566a',
      input: '#4c566a',
      primary: '#88c0d0',
      ring: '#88c0d0',
      success: '#a3be8c',
      warning: '#ebcb8b',
      danger: '#bf616a',
      info: '#81a1c1',
      sidebar: '#3b4252',
      shadowRgb: '0, 0, 0',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    mode: 'dark',
    description: 'High-contrast neon on deep purple-grey. The most ported palette there is.',
    source: 'https://spec.draculatheme.com/',
    palette: {
      background: '#21222c',
      surface: '#282a36',
      surfaceAlt: '#44475a',
      foreground: '#f8f8f2',
      mutedForeground: '#a8b2d8',
      border: '#44475a',
      input: '#44475a',
      primary: '#bd93f9',
      ring: '#bd93f9',
      success: '#50fa7b',
      warning: '#ffb86c',
      danger: '#ff5555',
      info: '#8be9fd',
      sidebar: '#282a36',
      shadowRgb: '0, 0, 0',
    },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    mode: 'dark',
    description: 'Soft pastels on desaturated indigo. Gentler than most dark themes.',
    source: 'https://github.com/catppuccin/palette (flavor: mocha)',
    palette: {
      background: '#181825',
      surface: '#1e1e2e',
      surfaceAlt: '#313244',
      foreground: '#cdd6f4',
      mutedForeground: '#a6adc8',
      border: '#45475a',
      input: '#585b70',
      primary: '#cba6f7',
      ring: '#cba6f7',
      success: '#a6e3a1',
      warning: '#f9e2af',
      danger: '#f38ba8',
      info: '#89b4fa',
      sidebar: '#1e1e2e',
      shadowRgb: '0, 0, 0',
    },
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    mode: 'dark',
    description: 'Warm retro amber on brown-grey. Low blue light, high nostalgia.',
    source: 'https://github.com/morhetz/gruvbox',
    palette: {
      background: '#282828',
      surface: '#3c3836',
      surfaceAlt: '#504945',
      foreground: '#ebdbb2',
      mutedForeground: '#bdae93',
      border: '#504945',
      input: '#665c54',
      primary: '#fe8019',
      ring: '#fe8019',
      success: '#b8bb26',
      warning: '#fabd2f',
      danger: '#fb4934',
      info: '#83a598',
      sidebar: '#3c3836',
      shadowRgb: '0, 0, 0',
    },
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    mode: 'light',
    description: 'The light half of Catppuccin — gentle greys with clear pastel accents.',
    source: 'https://github.com/catppuccin/palette (flavor: latte)',
    palette: {
      background: '#e6e9ef',
      surface: '#eff1f5',
      surfaceAlt: '#ccd0da',
      foreground: '#4c4f69',
      mutedForeground: '#5c5f77',
      border: '#bcc0cc',
      input: '#acb0be',
      primary: '#1e66f5',
      ring: '#1e66f5',
      success: '#40a02b',
      warning: '#df8e1d',
      danger: '#d20f39',
      info: '#209fb5',
      sidebar: '#eff1f5',
      shadowRgb: '76, 79, 105',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    mode: 'light',
    description: 'Warm cream paper, tuned for long reading. Easiest on tired eyes.',
    source: 'https://ethanschoonover.com/solarized/',
    palette: {
      background: '#eee8d5',
      surface: '#fdf6e3',
      surfaceAlt: '#e4ddc8',
      foreground: '#073642',
      mutedForeground: '#586e75',
      border: '#d3cbb7',
      input: '#93a1a1',
      primary: '#268bd2',
      ring: '#268bd2',
      success: '#859900',
      warning: '#b58900',
      danger: '#dc322f',
      info: '#2aa198',
      sidebar: '#fdf6e3',
      shadowRgb: '7, 54, 66',
    },
  },
  {
    id: 'high-contrast-light',
    name: 'High Contrast',
    mode: 'light',
    description: 'Maximum legibility — stronger borders and text for low-vision use.',
    source: 'https://github.com/primer/primitives (light-high-contrast)',
    palette: {
      background: '#ffffff',
      surface: '#ffffff',
      surfaceAlt: '#e7ecf0',
      foreground: '#010409',
      mutedForeground: '#0e1116',
      border: '#20252c',
      input: '#20252c',
      primary: '#0349b4',
      ring: '#0349b4',
      success: '#024c1a',
      warning: '#4e2c00',
      danger: '#a0111f',
      info: '#023b95',
      sidebar: '#ffffff',
      shadowRgb: '1, 4, 9',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald Garden',
    mode: 'light',
    description: 'Fresh botanical greens with crisp sage surfaces. Calming, focused, and natural.',
    source: 'Tailwind Emerald & Forest palette',
    palette: {
      background: '#f0fdf4',
      surface: '#ffffff',
      surfaceAlt: '#dcfce7',
      foreground: '#064e3b',
      mutedForeground: '#166534',
      border: '#86efac',
      input: '#86efac',
      primary: '#059669',
      ring: '#059669',
      success: '#15803d',
      warning: '#b45309',
      danger: '#dc2626',
      info: '#0284c7',
      sidebar: '#f0fdf4',
      shadowRgb: '6, 78, 59',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset Horizon',
    mode: 'light',
    description: 'Warm coral, apricot, and golden amber accents. Energetic, inviting, and radiant.',
    source: 'Warm Coral & Sunset specification',
    palette: {
      background: '#fff7ed',
      surface: '#ffffff',
      surfaceAlt: '#ffedd5',
      foreground: '#431407',
      mutedForeground: '#7c2d12',
      border: '#fdba74',
      input: '#fdba74',
      primary: '#ea580c',
      ring: '#ea580c',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#e11d48',
      info: '#0284c7',
      sidebar: '#fff7ed',
      shadowRgb: '67, 20, 7',
    },
  },
  {
    id: 'lavender',
    name: 'Lavender Blossom',
    mode: 'light',
    description: 'Gentle pastel lilac and soft violet accents. Elegant, serene, and friendly.',
    source: 'Lavender & Iris design language',
    palette: {
      background: '#fbf7fd',
      surface: '#ffffff',
      surfaceAlt: '#f3e8f9',
      foreground: '#2e1045',
      mutedForeground: '#5b21b6',
      border: '#d8b4fe',
      input: '#c084fc',
      primary: '#7c3aed',
      ring: '#7c3aed',
      success: '#15803d',
      warning: '#b45309',
      danger: '#dc2626',
      info: '#0284c7',
      sidebar: '#fbf7fd',
      shadowRgb: '46, 16, 69',
    },
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    mode: 'dark',
    description: 'Warm muted pine with dusty rose and lilac highlights. Dreamy and easy on tired eyes.',
    source: 'https://rosepinetheme.com/palette/specs/',
    palette: {
      background: '#191724',
      surface: '#1f1d2e',
      surfaceAlt: '#26233a',
      foreground: '#e0def4',
      mutedForeground: '#908caa',
      border: '#403d52',
      input: '#524f67',
      primary: '#eb6f92',
      ring: '#eb6f92',
      success: '#9ccfd8',
      warning: '#f6c177',
      danger: '#eb6f92',
      info: '#c4a7e7',
      sidebar: '#1f1d2e',
      shadowRgb: '0, 0, 0',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    mode: 'dark',
    description: 'Clean dark blue-black celebrating downtown Tokyo at night with neon cyan and lavender.',
    source: 'https://github.com/folke/tokyo-night.nvim',
    palette: {
      background: '#1a1b26',
      surface: '#24283b',
      surfaceAlt: '#2f3549',
      foreground: '#c0caf5',
      mutedForeground: '#a9b1d6',
      border: '#3b4261',
      input: '#414868',
      primary: '#7aa2f7',
      ring: '#7aa2f7',
      success: '#9ece6a',
      warning: '#e0af68',
      danger: '#f7768e',
      info: '#7dcfff',
      sidebar: '#1f2335',
      shadowRgb: '0, 0, 0',
    },
  },
  {
    id: 'synthwave',
    name: 'Synthwave 84',
    mode: 'dark',
    description: 'Outrun 80s neon aesthetic with glowing magenta, electric cyan, and deep retro purple.',
    source: 'https://github.com/robbowen/synthwave-vscode',
    palette: {
      background: '#262335',
      surface: '#2a2139',
      surfaceAlt: '#34294f',
      foreground: '#f0eff5',
      mutedForeground: '#a599c2',
      border: '#493c68',
      input: '#5c4d82',
      primary: '#ff7edb',
      ring: '#ff7edb',
      success: '#72f1b8',
      warning: '#fede5d',
      danger: '#fe4450',
      info: '#36f9f6',
      sidebar: '#241b2f',
      shadowRgb: '0, 0, 0',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai Pro',
    mode: 'dark',
    description: 'Vibrant classic developer palette with bright yellow, rose, mint, and sky accents.',
    source: 'https://monokai.pro/',
    palette: {
      background: '#221f22',
      surface: '#2d2a2e',
      surfaceAlt: '#3a373b',
      foreground: '#fcfcfa',
      mutedForeground: '#939293',
      border: '#49464e',
      input: '#5b5960',
      primary: '#ffd866',
      ring: '#ffd866',
      success: '#a9dc76',
      warning: '#fc9867',
      danger: '#ff6188',
      info: '#78dce8',
      sidebar: '#2d2a2e',
      shadowRgb: '0, 0, 0',
    },
  },
  {
    id: 'high-contrast-dark',
    name: 'High Contrast Dark',
    mode: 'dark',
    description: 'Maximum legibility OLED dark — deep black with high-contrast text and luminous borders.',
    source: 'https://github.com/primer/primitives (dark-high-contrast)',
    palette: {
      background: '#010409',
      surface: '#0d1117',
      surfaceAlt: '#161b22',
      foreground: '#ffffff',
      mutedForeground: '#f0f6fc',
      border: '#7d8590',
      input: '#8b949e',
      primary: '#2f81f7',
      ring: '#58a6ff',
      success: '#3fb950',
      warning: '#d29922',
      danger: '#f85149',
      info: '#58a6ff',
      sidebar: '#010409',
      shadowRgb: '0, 0, 0',
    },
  },
  {
    id: 'prism-light',
    name: 'Prism Light',
    mode: 'light',
    description: 'Vibrant chromatic light theme with a highlighted pastel orchid sidebar, radiant ruby accents, and rich spectrum shades.',
    source: 'Custom PMT Palette',
    palette: {
      background: '#faf5ff',
      surface: '#ffffff',
      surfaceAlt: '#f3e8ff',
      foreground: '#2e1065',
      mutedForeground: '#6b21a8',
      border: '#d8b4fe',
      input: '#c084fc',
      primary: '#e11d48',
      ring: '#e11d48',
      success: '#059669',
      warning: '#d97706',
      danger: '#dc2626',
      info: '#0284c7',
      sidebar: '#f3e8ff',
      shadowRgb: '107, 33, 168',
    },
  },
  {
    id: 'prism-dark',
    name: 'Prism Dark',
    mode: 'dark',
    description: 'High-vibrancy multi-hue dark theme with a deep amethyst obsidian canvas, highlighted violet sidebar, and neon rose accents.',
    source: 'Custom PMT Palette',
    palette: {
      background: '#0d0a1a',
      surface: '#17122b',
      surfaceAlt: '#251d45',
      foreground: '#fbfbfe',
      mutedForeground: '#b8b2dc',
      border: '#3f356d',
      input: '#53478c',
      primary: '#f43f5e',
      ring: '#f43f5e',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#f43f5e',
      info: '#06b6d4',
      sidebar: '#1f153d',
      shadowRgb: '0, 0, 0',
    },
  },
];

export type ThemeId = (typeof THEMES)[number]['id'];

/** 'system' follows the OS, resolving to the user's chosen day/night themes. */
export const SYSTEM_THEME = 'system' as const;
export type ThemePreference = typeof SYSTEM_THEME | string;

export const DEFAULT_DAY_THEME = 'light';
export const DEFAULT_NIGHT_THEME = 'dark';

const BY_ID = new Map(THEMES.map((theme) => [theme.id, theme]));

export const getTheme = (id: string): ThemeDefinition | undefined => BY_ID.get(id);

export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === 'string' && BY_ID.has(value);

export const themesByMode = (mode: ThemeMode): ThemeDefinition[] =>
  THEMES.filter((theme) => theme.mode === mode);

/** The scheme map the pre-paint script needs; kept here so it cannot drift from the registry. */
export const THEME_MODES: Record<string, ThemeMode> = Object.fromEntries(
  THEMES.map((theme) => [theme.id, theme.mode]),
);
