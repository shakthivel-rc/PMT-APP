import { test, expect } from '@playwright/test';
import { mockApi } from './support/mockApi';

test.describe('navigation', () => {
  test('moves between authenticated screens and shows the empty state', async ({ page }) => {
    await mockApi(page);
    // Seed a token so initializeAuth resolves the (mocked) profile and mounts the shell.
    await page.addInitScript(() => localStorage.setItem('access_token', 'e2e-access'));
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'User Management' })).toBeVisible();

    await page.getByRole('link', { name: 'Activity Log' }).click();
    await expect(page).toHaveURL(/\/activity$/);

    // No activity logged → the empty state rather than an empty table.
    await expect(page.getByText('No activity logs found')).toBeVisible();
  });
});
