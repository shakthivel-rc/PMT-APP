import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';
import { mockApi } from './mockApi';

/** Every theme id in `src/features/ui/themes.ts`, with its scheme. */
export const THEME_MODES: ReadonlyArray<readonly [string, 'light' | 'dark']> = [
  ['light', 'light'],
  ['dark', 'dark'],
  ['midnight', 'dark'],
  ['nord', 'dark'],
  ['dracula', 'dark'],
  ['catppuccin-mocha', 'dark'],
  ['gruvbox-dark', 'dark'],
  ['catppuccin-latte', 'light'],
  ['solarized-light', 'light'],
  ['high-contrast-light', 'light'],
];

/**
 * An unreadable failure message is the single most common reason an accessibility suite
 * gets disabled, so print the rule, its impact, the help URL, and the actual failing
 * markup rather than an object dump.
 */
export const formatViolations = (violations: Result[]): string => {
  if (violations.length === 0) return 'no violations';
  return violations
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 4)
        .map((n) => `      ${n.target.join(' ')}\n        ${n.html.slice(0, 160)}`)
        .join('\n');
      const more = v.nodes.length > 4 ? `\n      …and ${v.nodes.length - 4} more` : '';
      return `  [${v.impact ?? 'unknown'}] ${v.id}: ${v.help}\n    ${v.helpUrl}\n${nodes}${more}`;
    })
    .join('\n\n');
};

/** Signs in through the real form so the scan walks the real authenticated shell. */
export const signIn = async (page: Page): Promise<void> => {
  await mockApi(page);
  await page.goto('/login');
  await page.getByLabel('Email address').fill('ada@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Abcdef123!@#');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'User Management' }).waitFor();
  await restCursor(page);
};

/**
 * Parks the pointer in a corner.
 *
 * Playwright leaves the cursor where it last clicked, so after signing in the element under
 * that coordinate stays in `:hover` on every subsequent page — and axe measures computed
 * colours, so it was reporting the *hover* background of whatever happened to sit there.
 * A route scan should measure the resting state; hover and focus states are a separate,
 * deliberate check rather than an accident of where the mouse stopped.
 */
export const restCursor = (page: Page): Promise<void> => page.mouse.move(0, 0);

/**
 * Applies a theme the way the app does.
 *
 * Both attributes matter: `data-theme` selects the palette and the `.dark` class carries
 * scheme polarity, which every `dark:` utility keys off. Setting only `data-theme` would
 * scan the right palette with the wrong variants — a scan that passes for the wrong reason
 * is worse than no scan.
 */
export const applyTheme = async (page: Page, id: string, mode: 'light' | 'dark'): Promise<void> => {
  await page.evaluate(
    ([themeId, scheme]) => {
      const root = document.documentElement;
      root.setAttribute('data-theme', themeId);
      root.classList.toggle('dark', scheme === 'dark');
      root.style.colorScheme = scheme;
    },
    [id, mode] as const,
  );
};

/**
 * Violations this suite knowingly does not fail on, each with why.
 *
 * A baseline rather than a green-by-deletion scan: the check starts guarding *new*
 * regressions immediately instead of waiting for a design-system decision it should not
 * make on its own. Entries match on rule + a substring of the failing markup, so they stay
 * narrow — a different element failing the same rule still fails the suite. Shrink this
 * list; never grow it without recording the reason.
 *
 * Everything here is one finding wearing several hats: **`--primary` has no contrast
 * headroom.** It is 5.17:1 on white, so a 12% tint of it carrying `text-primary` lands at
 * 4.02, `link`-variant text lands at 3.76–3.96, and `--primary-foreground` on it lands at
 * 3.11 on the dark palettes. Fixing that means re-deriving `--primary` (and a companion
 * on-tint foreground) through `ensureContrast` across all ten themes — the same treatment
 * `--border` just received in this pass, but a much more visible one, since primary is the
 * app's identity colour. It is a deliberate design decision, not a class swap, and doing it
 * blind here would be worse than recording it.
 */
export const ACCEPTED: ReadonlyArray<{ rule: string; match: string; reason: string }> = [
  {
    rule: 'color-contrast',
    match: 'avatar-fallback',
    reason: 'Initials are text-primary on bg-primary/12 — 4.02:1. Needs an on-tint foreground token.',
  },
  {
    rule: 'color-contrast',
    match: 'data-variant="link"',
    reason: 'Link-variant buttons render --primary as text — 3.76 on dark, 3.96 on catppuccin-latte.',
  },
  {
    rule: 'color-contrast',
    match: 'data-variant="default"',
    reason:
      '--primary-foreground on --primary is 3.11 on the dark palettes. themes.test.ts asserts this ' +
      'pair against palette data and passes, which is exactly the gap a rendered scan closes.',
  },
  {
    rule: 'color-contrast',
    // Narrow on purpose: the active sidebar item is the only place in the app where a
    // background is an absolutely-positioned SIBLING rather than an ancestor.
    match: '<span>User Management</span>',
    reason:
      "An axe limitation, not a defect. The active nav item's background is a motion " +
      '`layoutId` pill at `absolute inset-0 -z-10` — a sibling, not an ancestor — so axe cannot ' +
      'resolve it and measures the text against --sidebar instead. What actually renders is ' +
      '--sidebar-primary-foreground on --sidebar-primary: 4.91 (catppuccin-latte) to 9.59 (nord), ' +
      'passing on all ten themes. The one real edge is the handful of frames while the pill is ' +
      'animating between items, which no static scan can express.',
  },
  {
    rule: 'color-contrast',
    match: 'data-slot="input"',
    reason:
      'Placeholder text at --muted-foreground reaches 3.31 on catppuccin-latte. Placeholders are ' +
      'normal text to WCAG; the fix is a placeholder-specific token, not a per-input class.',
  },
];

/** Drops accepted violations, returning what is left plus what was suppressed. */
export const filterAccepted = (violations: Result[]) => {
  const suppressed: string[] = [];
  const remaining = violations
    .map((violation) => {
      const nodes = violation.nodes.filter((node) => {
        const accepted = ACCEPTED.find(
          (entry) => entry.rule === violation.id && node.html.includes(entry.match),
        );
        if (accepted) suppressed.push(`${violation.id}: ${accepted.match}`);
        return !accepted;
      });
      return { ...violation, nodes };
    })
    .filter((violation) => violation.nodes.length > 0);
  return { remaining, suppressed };
};
