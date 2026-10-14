import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  applyTheme,
  filterAccepted,
  formatViolations,
  restCursor,
  signIn,
  THEME_MODES,
} from './support/a11y';

/**
 * Automated accessibility scanning — a floor, not a conformance claim.
 *
 * Playwright rather than jsdom, deliberately: jsdom computes no styles, so the
 * colour-contrast rule cannot run there at all — and contrast is the highest-yield rule
 * for a ten-palette design system. Here the scan walks the real authenticated shell with
 * real Tailwind applied and real computed colours.
 *
 * **What this cannot check, and what therefore stays manual.** W3C-WAI is explicit that no
 * tool alone determines conformance, and the gap is exactly where this app's real risk sits:
 *
 *   - keyboard-only traversal, including focus obscured by the `sticky top-0` header
 *   - focus return after a Radix dialog or sheet closes
 *   - whether toasts and live regions announce at the *right moment* rather than at all
 *   - reduced-motion behaviour of the sidebar pill and table rows
 *   - legibility at 200% zoom
 *
 * A suite that files only "add axe" and calls accessibility done would leave every one of
 * those untouched.
 */

const ROUTES = [
  ['/', 'User Management'],
  ['/timesheet', 'Timesheet'],
  ['/reports', 'Reports'],
  ['/reports/time_by_group', 'Time by group'],
  ['/rbac', 'Roles & Permissions'],
  ['/activity', 'Activity Log'],
  ['/profile', 'My Profile'],
] as const;

test.describe('axe: per route', () => {
  test('the unauthenticated login screen has no violations', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('Welcome back').waitFor();
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const { remaining } = filterAccepted([...violations]);
    expect(remaining, formatViolations(remaining)).toEqual([]);
  });

  // The two screens an emailed link opens. Public like /login, and reached cold from a mail
  // client by someone who may never have seen the app before.
  for (const [route, text] of [
    ['/reset-password?token=e2e', 'Set new password'],
    ['/verify-account?token=e2e', 'Activate your account'],
  ] as const) {
    test(`the emailed-link screen ${route.split('?')[0]} has no violations`, async ({ page }) => {
      await page.goto(route);
      await page.getByText(text).waitFor();
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const { remaining } = filterAccepted([...violations]);
      expect(remaining, formatViolations(remaining)).toEqual([]);
    });
  }

  for (const [route, label] of ROUTES) {
    test(`no violations on ${route}`, async ({ page }) => {
      await signIn(page);
      await page.goto(route);
      // Routes are React.lazy, so waiting for the heading is what stops the scan running
      // against the Suspense fallback and passing because there was nothing there.
      await page.getByRole('heading', { name: label, level: 1 }).waitFor();
      await restCursor(page);

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();

      const { remaining } = filterAccepted([...violations]);
      expect(remaining, formatViolations(remaining)).toEqual([]);
    });
  }
});

test.describe('axe: contrast across every theme', () => {
  // The part that pays for itself. Ten palettes carry the same tokens onto the same
  // surfaces, and this audit found nine of ten failing 3:1 on form boundaries and two
  // failing 4.5:1 on destructive controls -- none of which a single-theme scan would see.
  for (const [id, mode] of THEME_MODES) {
    test(`no colour-contrast violations under ${id}`, async ({ page }) => {
      await signIn(page);
      await applyTheme(page, id, mode);
      await restCursor(page);

      const { violations } = await new AxeBuilder({ page })
        .withRules(['color-contrast'])
        .analyze();

      const { remaining } = filterAccepted([...violations]);
      expect(remaining, formatViolations(remaining)).toEqual([]);
    });
  }
});

test.describe('axe: portalled content', () => {
  // Radix renders dialogs, sheets and popovers into a portal, so they are absent from the
  // DOM until opened and a route-level scan never sees them.
  test('the mobile navigation drawer has no violations', async ({ page }) => {
    // Sign in at desktop width -- the sidebar link the helper waits for is not rendered
    // below `lg`, where navigation lives behind the drawer this test is about.
    await signIn(page);
    await page.setViewportSize({ width: 480, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: /open sidebar|menu/i }).first().click();
    await page.getByRole('dialog').waitFor();

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const { remaining } = filterAccepted([...violations]);
    expect(remaining, formatViolations(remaining)).toEqual([]);
  });
});
