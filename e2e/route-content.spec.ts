/**
 * Every navigation puts content on screen, immediately and unconditionally.
 *
 * The route wrapper used to be `AnimatePresence mode="wait"` around a `motion.div` whose
 * `initial` was `opacity: 0`. That made two separate things true that must not be true of
 * the element every screen renders through: the incoming route was only *mounted* once the
 * outgoing one's exit animation reported completion, and an element that never got animated
 * rested at invisible. Both fail identically and unhelpfully — a shell that looks completely
 * healthy wrapped around an empty content area, with nothing in the console to explain it.
 *
 * So these assert the property rather than the implementation: after a navigation there is
 * content in `<main>`, it is opaque, and that is still true when the clicks come faster than
 * any transition.
 */
import { test, expect } from '@playwright/test';
import { mockApi } from './support/mockApi';

const readMain = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const main = document.querySelector('#main') as HTMLElement | null;
    const wrapper = main?.firstElementChild as HTMLElement | null;
    return {
      children: main?.children.length ?? -1,
      descendants: wrapper?.querySelectorAll('*').length ?? 0,
      opacity: wrapper ? Number(getComputedStyle(wrapper).opacity) : -1,
      text: (main?.innerText ?? '').trim().length,
    };
  });

test.describe('route content', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.addInitScript(() => localStorage.setItem('access_token', 'e2e-access'));
  });

  test('is mounted and opaque after navigating', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Activity Log' })).toBeVisible();

    await page.getByRole('link', { name: 'Activity Log' }).click();
    await expect(page).toHaveURL(/\/activity$/);
    await expect(page.getByText('No activity logs found')).toBeVisible();

    const main = await readMain(page);
    expect(main.children).toBeGreaterThan(0);
    expect(main.descendants).toBeGreaterThan(3);
    expect(main.opacity).toBe(1);
    expect(main.text).toBeGreaterThan(0);
  });

  test('survives clicks that come faster than the transition', async ({ page }) => {
    // The failure being guarded is a hand-off that never completes, which only shows up when
    // the next navigation starts before the previous one has settled.
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Activity Log' })).toBeVisible();

    for (let round = 0; round < 3; round += 1) {
      for (const name of ['Activity Log', 'User Management']) {
        await page.getByRole('link', { name }).click();
        await page.waitForTimeout(30);
      }
    }

    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
    const main = await readMain(page);
    expect(main.children).toBeGreaterThan(0);
    expect(main.opacity).toBe(1);
    expect(main.text).toBeGreaterThan(0);
  });
});
