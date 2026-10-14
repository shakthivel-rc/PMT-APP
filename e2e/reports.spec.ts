import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { applyTheme, filterAccepted, formatViolations, restCursor, signIn, THEME_MODES } from './support/a11y';

/**
 * Reports, end to end against the mocked API: reached from the navigation, a filter is the
 * URL, an export downloads a file, the export dialog passes axe, and the chart takes its
 * colours from the theme rather than from fixed values.
 */

test.describe('reports', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('opens from the navigation, then a report from the catalogue', async ({ page }) => {
    await page.getByRole('link', { name: 'Reports' }).first().click();
    await expect(page).toHaveURL(/\/reports(\?|$)/);
    await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
    await page.getByTestId('category-time').getByRole('link', { name: /Time by group/ }).click();
    await expect(page).toHaveURL(/\/reports\/time_by_group\?/);
    await expect(page.getByRole('heading', { name: 'Time by group', level: 1 })).toBeVisible();
    await expect(page.getByTestId('kpi-total')).toContainText('2h 30m');
    await expect(page.getByTestId('report-chart')).toHaveAttribute('data-kind', 'bar');
    await expect(page.getByRole('table', { name: /Time by group/ })).toContainText('Payments');
  });

  test('writes filters to the URL, and a reload keeps them', async ({ page }) => {
    await page.goto('/reports/time_by_group?workspace=w1');
    await expect(page.getByTestId('kpi-total')).toBeVisible();
    await page.getByRole('combobox', { name: 'Dates' }).click();
    await page.getByRole('option', { name: 'Last month' }).click();
    await expect(page).toHaveURL(/preset=last_month/);
    await page.getByRole('combobox', { name: 'Group by' }).click();
    await page.getByRole('option', { name: 'Project' }).click();
    await expect(page).toHaveURL(/group_by=project/);

    const request = page.waitForRequest((r) => r.url().includes('/reports/time_by_group?') && r.url().includes('preset=last_month'));
    await page.reload();
    const url = new URL((await request).url());
    expect(url.searchParams.get('preset')).toBe('last_month');
    expect(url.searchParams.getAll('group_by')[0]).toBe('project');
    await expect(page.getByRole('combobox', { name: 'Dates' })).toContainText('Last month');
  });

  test('downloads an export', async ({ page }) => {
    await page.goto('/reports/time_by_group?workspace=w1&preset=last_week');
    await expect(page.getByTestId('kpi-total')).toBeVisible();
    await page.getByRole('button', { name: 'Export' }).click();
    const dialog = page.getByRole('dialog', { name: 'Export report' });
    await expect(dialog).toBeVisible();

    await restCursor(page);
    const { violations } = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const { remaining } = filterAccepted([...violations]);
    expect(remaining, formatViolations(remaining)).toEqual([]);

    const sent = page.waitForRequest((r) => r.url().endsWith('/reports/time_by_group/export') && r.method() === 'POST');
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export' }).click();
    expect((await download).suggestedFilename()).toBe('time-by-group.csv');
    expect((await sent).postDataJSON()).toMatchObject({ format: 'csv', params: { preset: 'last_week' } });
    await expect(dialog).toBeHidden();
  });

  test('a loaded report, and the Reports home, have no violations', async ({ page }) => {
    for (const [route, ready] of [
      ['/reports/time_by_group?workspace=w1', 'kpi-total'],
      ['/reports?workspace=w1', 'category-time'],
    ] as const) {
      await page.goto(route);
      await expect(page.getByTestId(ready)).toBeVisible();
      await restCursor(page);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const { remaining } = filterAccepted([...violations]);
      expect(remaining, `${route}\n${formatViolations(remaining)}`).toEqual([]);
    }
  });

  test('draws the chart in the theme’s colours', async ({ page }) => {
    await page.goto('/reports/time_by_group?workspace=w1');
    const bar = page.getByTestId('report-chart').locator('svg rect[fill^="var("]').first();
    await expect(bar).toBeVisible();
    const fillUnder = async (id: string, mode: 'light' | 'dark') => {
      await applyTheme(page, id, mode);
      return bar.evaluate((el) => getComputedStyle(el).fill);
    };
    const light = await fillUnder('light', 'light');
    const dracula = await fillUnder('dracula', 'dark');
    expect(light).not.toBe('');
    expect(dracula).not.toBe(light);
  });
});

test.describe('reports: contrast across every theme', () => {
  for (const [id, mode] of THEME_MODES) {
    test(`a loaded report has no colour-contrast violations under ${id}`, async ({ page }) => {
      await signIn(page);
      await page.goto('/reports/time_by_group?workspace=w1');
      await expect(page.getByTestId('kpi-total')).toBeVisible();
      await applyTheme(page, id, mode);
      await restCursor(page);
      // The report itself: the shell around it is the a11y suite's, under the same themes.
      const { violations } = await new AxeBuilder({ page }).include('#main').withRules(['color-contrast']).analyze();
      const { remaining } = filterAccepted([...violations]);
      expect(remaining, formatViolations(remaining)).toEqual([]);
    });
  }
});
