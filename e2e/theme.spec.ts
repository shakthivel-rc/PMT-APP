import { test, expect } from '@playwright/test';
import { mockApi } from './support/mockApi';

test.describe('theme', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, { authenticated: false });
  });

  test('toggling the theme updates the root and survives a reload', async ({ page }) => {
    await page.goto('/login'); // AuthLayout carries a ThemeToggle

    const html = page.locator('html');
    const before = (await html.getAttribute('class')) ?? '';

    await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).click();
    const after = (await html.getAttribute('class')) ?? '';
    expect(after).not.toBe(before);

    // Persisted under the multi-theme key and reapplied pre-paint on reload.
    expect(await page.evaluate(() => localStorage.getItem('nx-theme'))).toBeTruthy();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('class', after);
  });

  test('a named theme is applied as data-theme and restored before first paint', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: 'Choose a theme' }).click();
    await page.getByRole('menuitem', { name: 'Nord' }).click();

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'nord');
    // Nord is a dark palette, so the polarity flag that drives every `dark:` utility is on.
    await expect(html).toHaveClass(/dark/);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord');
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('the theme actually repaints the page, not just the attribute', async ({ page }) => {
    await page.goto('/login');
    const background = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.getByRole('button', { name: 'Choose a theme' }).click();
    await page.getByRole('menuitem', { name: 'Solarized Light' }).click();
    const solarized = await background();

    await page.getByRole('button', { name: 'Choose a theme' }).click();
    await page.getByRole('menuitem', { name: 'Gruvbox Dark' }).click();
    const gruvbox = await background();

    expect(solarized).not.toBe(gruvbox);
    // Solarized Light's page tone is its own cream, not the stock slate.
    expect(solarized).toBe('rgb(238, 232, 213)');
  });

  test('a user who chose dark under the old two-theme setting keeps it', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await page.goto('/login');

    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('nx-theme'))).toBe('dark');
  });
});
