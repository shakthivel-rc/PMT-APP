import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

/** Where the already-running Docker stack serves the SPA (nginx strips the /api prefix). */
const LIVE_BASE_URL = process.env.LIVE_API_URL ?? 'http://localhost:8080';

/**
 * Which `--project` names this invocation asked for.
 *
 * `webServer` is a *top-level* key, not a per-project one, so `--project=live` would
 * otherwise still spend ~2 minutes building and previewing a bundle the live project
 * never visits (it points at :8080, which is already up). Playwright exposes no hook
 * for "which projects were selected", so reading argv is the only way to make a
 * top-level key conditional on the selection. Both spellings are accepted, and the
 * flag may be repeated.
 */
function selectedProjects(argv: string[]): string[] {
  const names: string[] = [];
  argv.forEach((arg, i) => {
    if (arg === '--project' || arg === '-p') {
      const value = argv[i + 1];
      if (value && !value.startsWith('-')) names.push(value);
    } else if (arg.startsWith('--project=')) {
      names.push(arg.slice('--project='.length));
    }
  });
  return names;
}

const selected = selectedProjects(process.argv.slice(2));
// Only skip the hermetic server when *every* selected project is the live one. A bare
// `playwright test` (no --project) still builds and previews, because chromium needs it.
const liveOnly = selected.length > 0 && selected.every((name) => name === 'live');

/**
 * Hermetic E2E: build the SPA and serve it with `vite preview`, then intercept the
 * API at the browser boundary with `page.route` (see e2e/support/mockApi.ts). No
 * backend is required, so runs are deterministic locally and in CI.
 *
 * The `live` project is the deliberate opposite: no mocks, no build, a real browser
 * against the real stack. The two never mix, because `testDir` is per-project —
 * chromium inherits the top-level './e2e' and so can never collect './e2e-live'.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'reports/playwright-junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // testDir is inherited from the top level ('./e2e'), which is what keeps the
      // hermetic suite from ever collecting the live spec.
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'live',
      testDir: './e2e-live',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: LIVE_BASE_URL,
        // Traces record action parameters verbatim, including the value passed to
        // `fill()`. The live spec types a real superadmin password, so tracing is off
        // here rather than risking it being written to reports/. Screenshots are safe:
        // the field is type=password.
        trace: 'off',
      },
    },
  ],
  webServer: liveOnly
    ? undefined
    : {
        // Build with a same-origin API base so page.route interception isn't blocked by
        // CORS (the default .env base is an absolute cross-origin host). Then preview it.
        command: `VITE_API_BASE_URL=/api npm run build && npm run preview -- --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
