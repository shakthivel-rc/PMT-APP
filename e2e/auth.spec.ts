import { test, expect } from '@playwright/test';
import { mockApi } from './support/mockApi';

test.describe('authentication', () => {
  test('redirects an unauthenticated visit to /login', async ({ page }) => {
    await mockApi(page, { authenticated: false });
    await page.goto('/');
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('signs in and lands on the authenticated shell', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');

    await page.getByLabel('Email address').fill('ada@example.com');
    // exact: avoid also matching the "Show password" toggle button.
    await page.getByLabel('Password', { exact: true }).fill('Abcdef123!@#');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // PublicOutlet redirects an authenticated user to "/", which mounts the app shell.
    await expect(page.getByRole('link', { name: 'User Management' })).toBeVisible();
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/`);
  });
});
