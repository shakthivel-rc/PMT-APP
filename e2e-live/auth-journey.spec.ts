/**
 * A real browser against the real stack.
 *
 * Every other spec in this repository mocks the API — the hermetic e2e suite intercepts at
 * the browser boundary with `page.route`, the Vitest suite uses MSW, and the backend suite
 * runs against throwaway SQLite. All three are deterministic, and all three would have gone
 * green while the deployed app was completely unusable: `GET /users/profile` returned a bare
 * 500 (there was no global exception handler then, so an uncaught error was not an envelope),
 * and `loginUser` fetches the profile immediately after the token exchange. Login therefore
 * failed with "Invalid email or password" for a correct password, and nothing in any suite
 * could see it because every suite supplied its own profile response.
 *
 * The same blind spot covers asset serving: a module chunk served with the wrong Content-Type
 * (an `.mjs` with no nginx MIME mapping) returns 200 and is still refused by the browser. Only
 * a browser talking to the real nginx can notice.
 *
 * So the contract asserted here is deliberately unglamorous: the seeded account can sign in,
 * the shell renders data that could only have come from a successful profile call, the routes
 * a user actually clicks through do not emit a 5xx or a console error, and signing out lands
 * back on the login screen. It is the smoke test that the mocked suites cannot be.
 *
 * Re-runnability and courtesy to other writers:
 *   - Each sign-in creates a `user_sessions` row, and `afterEach` revokes it.
 *     `logout_controller` deletes the single row matching that exact bearer token, so a browser
 *     sign-out cannot disturb a pytest session or another client running against this stack.
 *   - Each sign-in and sign-out also appends a LOGIN or LOGOUT entry to the activity log.
 *     Those are audit records, so nothing here removes them: every run grows the shared log.
 *   - No assertion depends on a global count, on being the only writer, or on the database
 *     being empty.
 */
import { test, expect, type Page } from '@playwright/test';

const LIVE_URL = process.env.LIVE_API_URL ?? 'http://localhost:8080';
// `||` rather than `??`, matching the API's live conftest and seeder: the API's .env.example
// ships SUPERADMIN_EMAIL blank, and blank means "the default", not an empty email.
const EMAIL = process.env.SUPERADMIN_EMAIL?.trim() || 'superadmin@base-project.local';
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? '';

/* ------------------------------------------------------------------ *
 * Skip gates
 * ------------------------------------------------------------------ */

// Cached per worker: the probe is a network round trip and the answer cannot change
// mid-run in a way worth re-checking.
let reachable: boolean | undefined;

async function stackIsUp(): Promise<boolean> {
  if (reachable !== undefined) return reachable;
  try {
    const res = await fetch(LIVE_URL, { signal: AbortSignal.timeout(5_000) });
    reachable = res.ok;
  } catch {
    reachable = false;
  }
  return reachable;
}

/* ------------------------------------------------------------------ *
 * Failure recorder
 * ------------------------------------------------------------------ */

interface Problem {
  kind: string;
  detail: string;
}

/**
 * Attach listeners before the first navigation. The three signals are complementary and
 * each one catches a different real regression:
 *   - a >= 500 response is the /users/profile bug, and a 500 is *always* a backend bug here
 *     because the API answers every expected failure with a 4xx envelope;
 *   - a console error is how a browser reports a module it refused to execute, which is the
 *     only symptom a mis-served chunk ever produces;
 *   - a pageerror is an uncaught exception that React's error boundary may have swallowed
 *     into a rendered fallback the test would otherwise walk straight past.
 */
function recordFailures(page: Page): Problem[] {
  const problems: Problem[] = [];

  page.on('response', (res) => {
    if (res.status() >= 500) {
      problems.push({ kind: `http ${res.status()}`, detail: `${res.request().method()} ${res.url()}` });
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push({ kind: 'console.error', detail: msg.text() });
  });
  page.on('pageerror', (err) => {
    problems.push({ kind: 'pageerror', detail: err.message });
  });

  return problems;
}

const describeProblems = (problems: Problem[]) =>
  problems.map((p) => `  [${p.kind}] ${p.detail}`).join('\n');

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Fills the real login form. The password is never logged; tracing is off for this project. */
async function signIn(page: Page): Promise<void> {
  test.skip(!PASSWORD, 'SUPERADMIN_PASSWORD is not set — cannot exercise a real sign-in.');

  await page.goto('/login');
  await expect(page.getByText('Welcome back')).toBeVisible();

  await page.getByLabel('Email address').fill(EMAIL);
  // `exact` avoids also matching the "Show password" toggle, whose label contains "Password".
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The shell only mounts once `loginUser` has *also* resolved GET /users/profile, so this
  // locator is the assertion that the profile call succeeded — not merely the token exchange.
  await expect(page.getByRole('link', { name: 'User Management' })).toBeVisible({ timeout: 20_000 });
}

test.beforeEach(async () => {
  test.skip(
    !(await stackIsUp()),
    `No stack answering at ${LIVE_URL} — start it with \`make up\` in pmt-api, or run the hermetic project instead.`,
  );
});

test.afterEach(async ({ page }) => {
  // Revoke this browser's session so repeated runs do not pile rows into `user_sessions`,
  // which nothing ever prunes. Best-effort: a failure here must never fail a passing test.
  if (page.isClosed()) return;
  const token = await page.evaluate(() => localStorage.getItem('access_token')).catch(() => null);
  if (!token) return;
  await fetch(`${LIVE_URL}/api/user/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5_000),
  }).catch(() => {});
});

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

test.describe('live: authentication journey', () => {
  test('an unauthenticated visit is served the login screen', async ({ page }) => {
    /**
     * The cheapest possible proof that the deployed bundle is intact: nginx served
     * index.html, the hashed asset chunks resolved, React mounted and `ProtectedShell`
     * redirected to /login. A build that fails to boot at all shows up here first, and
     * this is the one test that needs no credentials.
     */
    const problems = recordFailures(page);

    await page.goto('/');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

    expect(problems, `Unexpected failures loading the login screen:\n${describeProblems(problems)}`).toEqual([]);
  });

  test('the seeded superadmin can sign in and lands on the authenticated shell', async ({ page }) => {
    /**
     * The end-to-end credential path across every real seam: the browser posts to nginx,
     * nginx strips `/api` and proxies to uvicorn, the controller verifies a bcrypt hash
     * against the row the seeder wrote, mints a JWT and inserts a `user_sessions` row, and
     * the very next request presents that token back through the middleware.
     *
     * Any one of those being wrong reads identically to the user — "Invalid email or
     * password" — because `loginUser` collapses every failure into one rejection message.
     * That is precisely why this has to be asserted against the real stack.
     */
    const problems = recordFailures(page);

    await signIn(page);

    // PublicOutlet bounces an authenticated user to "/", which mounts the shell.
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/`);
    await expect(page.getByRole('link', { name: 'Activity Log' })).toBeVisible();

    expect(problems, `Unexpected failures during sign-in:\n${describeProblems(problems)}`).toEqual([]);
  });

  test('the shell renders the signed-in user, proving GET /users/profile answered', async ({ page }) => {
    /**
     * The regression this file exists for. Tokens are not enough: the header's name, role
     * and email are read off `state.auth.user`, which is populated *only* from the profile
     * response — a mocked suite fabricates it, so the 500 was invisible everywhere else.
     *
     * The identity is asserted rather than merely "some name is shown", because a blank
     * string renders as an empty element that a presence check happily passes. The email is
     * the configured login identity, so this stays honest if the seeded name ever changes.
     */
    const problems = recordFailures(page);

    await signIn(page);

    const accountMenu = page.getByRole('button', { name: 'Account menu' });
    await expect(accountMenu).toBeVisible();

    await accountMenu.click();
    await expect(page.getByRole('menu')).toContainText(EMAIL);
    // A role name is derived from user.roles[0]; "No Role" is the fallback for an empty
    // list, so seeing it would mean the profile arrived without its roles relationship.
    await expect(page.getByRole('menu')).not.toContainText('No Role');

    await page.keyboard.press('Escape');

    expect(problems, `Unexpected failures reading the profile:\n${describeProblems(problems)}`).toEqual([]);
  });

  test('navigating the authenticated routes emits no 5xx and no console error', async ({ page }) => {
    /**
     * Each of these screens fans out to a different router the moment it mounts — users,
     * activity logs, roles and permissions — and each is a lazily-imported chunk, so this
     * also proves every code-split asset is fetchable from nginx. That second property is not
     * incidental: an asset served with a Content-Type the browser refuses still returns 200,
     * and surfaces only as a console error.
     *
     * The assertion is on the *class* of failure, not on any screen's contents, so it stays
     * true while other clients write to this same database concurrently.
     */
    const problems = recordFailures(page);

    await signIn(page);

    // `link` and `title` are separate because they differ on one route: the sidebar says
    // "Profile" and the header says "My Profile" (see NAV_ITEMS in src/config/nav.tsx).
    const routes = [
      { link: 'Activity Log', title: 'Activity Log', path: '/activity' },
      { link: 'Roles & Permissions', title: 'Roles & Permissions', path: '/rbac' },
      { link: 'Profile', title: 'My Profile', path: '/profile' },
    ];

    for (const route of routes) {
      await page.getByRole('link', { name: route.link }).click();
      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
      // The <header> banner title is driven by titleForPath, so it changes only after the
      // route has committed. It is a <p>, not a heading (see Header.tsx for why), so it is
      // matched as exact text; scoping to the banner keeps the screen's own PageHeader <h1>
      // out of the match.
      await expect(page.getByRole('banner').getByText(route.title, { exact: true })).toBeVisible();
      // Give the screen's own fetches time to land and fail, rather than navigating away
      // from a request that would have 500'd.
      await page.waitForLoadState('networkidle');
    }

    expect(problems, `Unexpected failures while navigating:\n${describeProblems(problems)}`).toEqual([]);
  });

  test('signing out revokes the session and returns to the login screen', async ({ page }) => {
    /**
     * Sign-out must do three things, and the UI only shows one of them. `logoutUser` clears
     * the stored tokens even when the backend call fails, so a green-looking redirect can
     * still leave a live `user_sessions` row behind — the token would keep working for
     * anyone holding a copy. This asserts the visible redirect, the cleared storage, and
     * that the revoked token is genuinely rejected afterwards.
     */
    const problems = recordFailures(page);

    await signIn(page);

    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(token, 'signing in should have stored an access token').toBeTruthy();

    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('access_token')))
      .toBeNull();

    // The row is gone, so the middleware's session lookup misses and the token is dead.
    const res = await fetch(`${LIVE_URL}/api/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    expect(res.status, 'a signed-out access token must no longer authenticate').toBe(401);

    expect(problems, `Unexpected failures during sign-out:\n${describeProblems(problems)}`).toEqual([]);
  });
});
