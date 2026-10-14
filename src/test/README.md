# Base Project App test suite

Automated tests for the React SPA. Built on **Vitest + React Testing Library + MSW**
(unit/component/integration) and **Playwright** (E2E). Config lives in
[`../../vitest.config.ts`](../../vitest.config.ts), [`../../playwright.config.ts`](../../playwright.config.ts)
and this folder's [`setup.ts`](setup.ts).

## How to run

```bash
cd pmt-app
npm install

npm run typecheck        # tsc --noEmit (the only static check the esbuild build skips)
npm test                 # vitest run (unit + component + integration)
npm run test:watch       # vitest watch mode
npm run test:coverage    # vitest run --coverage → coverage/ + reports/vitest-junit.xml (CI)
npm run test:e2e         # playwright (builds + previews the app, mocks the API)
npm run verify           # typecheck + lint + coverage — the full gate
```

## Harness

- **[setup.ts](setup.ts)** installs jsdom polyfills **before any store import** —
  critically `window.matchMedia`, which `features/ui/uiSlice.ts` calls at module-eval time.
  It also stubs `ResizeObserver` / `scrollIntoView` / pointer-capture (needed by Radix),
  registers jest-dom matchers, and runs the MSW server (`onUnhandledRequest: 'error'`, so a
  test can never silently hit the network).
- **[renderWithProviders.tsx](renderWithProviders.tsx)** wraps components in the real
  provider stack (Redux store built from the same 4 reducers + `MemoryRouter` +
  `MotionConfig`), with `preloadedState` support.
- **[msw/handlers.ts](msw/handlers.ts)** mocks the backend at the network layer (matched by
  URL suffix, so the resolved `BASE_URL` doesn't matter). **[fixtures.ts](fixtures.ts)**
  holds typed factory data.
- E2E ([`../../e2e`](../../e2e)) is hermetic: `page.route` intercepts the API, so no backend
  is required. The bundle is built with a same-origin `/api` base to avoid CORS on mocks.

## What is covered

- **Tier 1 — pure logic (every module above 90% lines, most at 100%):** `lib/passwordRules`,
  `lib/utils`, `lib/pagination`, `lib/theme`, `lib/lazyWithRetry`, `config/nav`,
  `types/index` helpers, `components/StatusBadge` `activityTone` mapper.
- **Tier 2 — reducers:** `usersSlice`, `uiSlice`.
- **Tier 3 — api + components:** `api/client` (401→refresh→retry),
  `api/users`/`rbac`/`activityLogs` mappers (via MSW), `actions/*` branch logic; component
  tests for the shared primitives (`PasswordInput`, `FormMessage`, `ConfirmDialog`,
  `RouteError`, `ThemeToggle`, `ToastBridge`, `PasswordStrengthMeter`, `UserAvatar`, …);
  auth integration (`Login`, `OTPVerification`, and the emailed-link screens `ResetPassword`
  and `AcceptInvite`, which drive their thunks through MSW end to end), `authSlice`'s
  late-result guard, and an `App` routing test that includes both emailed-link routes — the
  SPA half of the link contract with the API.
- **Projects:** `api/workspaces` and `api/issues` (paths, bodies, the 404/409/503 refusals and
  the AI-job polling loop, abort included) at 100%; `features/projects/boardPosition` — the
  after/before-neighbour arithmetic a drop turns into — as pure unit tests; and component tests
  for the workspace home, the hierarchy's role gating, the board (keyboard Move-to, drag and
  drop, rollback on refusal, quick-add), the list view regrouping the board without a second
  fetch, and the drawer (comments, text-only rendering, summary polling, the 503 message).
  Changing a workspace and its members: `lib/workspaceRules` (who may delete, which roles each
  role may give, whose row each role may change) as pure unit tests, and component tests for the
  Projects page's Edit and Delete dialogs (type-the-name confirmation, refusals, focus return)
  and the members dialog's role select, Remove and Leave (gating, confirm steps, the API's
  403/409 shown as worded, focus return).
  Those components sit outside `coverage.include` like every other feature component.
- **E2E:** login → authenticated shell, protected-route redirect, theme persistence,
  cross-screen navigation + the Activity Log empty state, route content, axe scans over every
  route and theme; plus an opt-in live auth journey (`e2e-live`).

Coverage is scoped (see `vitest.config.ts` `coverage.include`) to the logic we test, so the
number is meaningful, and gated by ratchet floors in the config (`npm run test:coverage`
prints the current figures).

## What is intentionally NOT covered (and why)

- **The rest of `authSlice`'s async thunks** — still the largest uncovered surface. The
  reset and invite thunks are exercised end to end by their screens' tests; login, register,
  OTP, profile and change-password lifecycles are not, and raising this is the obvious next
  ratchet step.
- **`lib/reportRenderError`** — the last-resort error reporter, which by construction only
  runs when React has already failed to render.
- **`Dashboard` / `RolesAndPermissions` route wrappers** — they only mount their `*Client`
  children, which own the data loading and the real logic and are tested directly.
- **shadcn/ui primitives (`components/ui/**`)** and **layout chrome** — vendored copy-in
  code / app-shell scaffolding, excluded from the coverage gate (the shell is exercised by
  E2E instead).
