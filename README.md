# Base Project App

React 19 single-page app for **Base Project** — authentication, user management, roles &
permissions, activity log and profile; a reusable base for admin products.

Consumes the FastAPI backend in the [`pmt-api`](https://github.com/your-org/pmt-api) repository.

---

## Screens

| Route | Screen | What it does |
|---|---|---|
| `/` | User Management | User statistics overview and user management |
| `/projects` | Projects | The caller's workspaces; create one (name + slug). Admins and owners edit one; owners delete one (soft: it disappears for every member, its history is kept) after typing its name |
| `/projects/:workspaceId` `/projects/:workspaceId/lists/:listId` | Workspace | Spaces › folders › lists, and the chosen list as a Board or a List (`?view=list`) with an issue drawer: comments, linked PRs and an AI thread summary. Its Members dialog adds members, changes roles and removes members (admins and owners), and lets anyone leave |
| `/rbac` | Roles & Permissions | Create permissions, assign them to roles |
| `/activity` | Activity Log | Paginated audit trail |
| `/profile` | Profile | Account details, password change, theme |
| `/login` `/register` `/verify-otp` `/set-password` `/forgot-password` | Auth | Public flows under a separate layout |
| `/reset-password?token=` `/verify-account?token=` | Emailed links | Choose a new password; accept an admin's invite. The API builds these links (`utils/token.py:app_link`), so the paths are a contract with it. The token goes back in the POST body, never a URL. Open whether or not someone is signed in |

Protected screens render inside `AppShell`; public auth screens render inside `AuthLayout`.

## Stack

React 19.2 · Vite 6.4 · TypeScript 5.8 · Redux Toolkit 2.6 · React Router 7 ·
Tailwind CSS v4 · shadcn/ui (New York, on `radix-ui`) · `motion` · lucide-react · sonner

12 runtime dependencies, all used. HTTP is platform `fetch` only — there is no axios and no
HTTP client dependency.

## Quick start

**Running the whole product** — this SPA is one half of it; the API and its MySQL are the other.
The backend repo owns the one-command setup and clones this one for you:

```bash
git clone https://github.com/your-org/pmt-api.git && cd pmt-api && make setup
```

That brings up MySQL, the API and this SPA behind nginx on <http://localhost:8080>. It is the
path to take if you just want to see the thing run.

**Working on the SPA alone**, with hot reload and an API already running on `:8000`:

```bash
npm install
npm run dev          # http://localhost:3000
```

The dev server proxies `/api/*` to the backend — see the proxy note below, it has a sharp edge.

```bash
npm run build        # production bundle -> dist/
npm run preview      # serve dist/ (NOTE: no /api proxy — see below)
npm run typecheck    # the build does NOT type-check
npm run lint         # eslint
npm run test         # vitest run
npm run test:coverage
npm run test:e2e     # playwright
npm run verify       # typecheck + lint + tests with coverage
```

### The `/api` proxy strips its own prefix

`vite.config.ts` rewrites `/api/*` → `*` against `http://localhost:8000`. So
`/api/user/login` correctly reaches `/user/login`. But the backend's health router is
*already* prefixed `/api/v1/health`, so through the dev proxy you must request
`/api/api/v1/health/ready`. The backend is inconsistent here: `/user/*`, `/users/*`,
`/roles/*`, `/permissions/*` and `/activity-logs` are unprefixed, and only health carries
`/api/v1`.

`npm run preview` serves the built bundle and **does not apply `server.proxy`** — set
`VITE_API_BASE_URL` to an absolute URL when previewing.

## Configuration

Copy `.env.example` to `.env.local` and fill it in. Only `VITE_API_BASE_URL` is meaningful
(default `/api`).

> **Client code holds no credentials of any kind.** Every secret lives only in the backend's
> environment and never reaches a browser.
> `vite.config.ts` keeps Vite's `VITE_` prefix guard and defines nothing, so a non-public
> variable cannot reach a browser bundle.

## Architecture

```
src/
  api/          fetch wrapper + per-domain modules (client, users, rbac, activityLogs, workspaces, issues)
  app/          store.ts (4 reducers), typed hooks
  components/   shared components + ui/ (15 shadcn primitives)
  config/       nav.tsx — single source for nav items and header titles
  features/     auth (screens + AuthLayout, the public shell), users, ui, rbac, activity, profile, projects,
                time (timer slice, timesheet)
  layouts/      AppShell (the authenticated shell)
  lib/          cn(), passwordRules, pagination, datetime, theme, lazyWithRetry, useBusy,
                duration, week, useNow
  test/         setup, renderWithProviders, fixtures, MSW handlers
  index.css     the design system: tokens, @theme bridge, base layer
```

**State.** Exactly four registered reducers: `auth`, `users`, `ui` and `timer` (added
2026-10-05: the header and the issue drawer must agree on the one running timer, which component
state cannot do). The `rbac`, `activity`, `profile` and `projects` folders are feature folders
with **no slice** — they hold component state, and so does the rest of `time`. Always use the typed `useAppSelector` / `useAppDispatch` hooks; async flows go through
`createAsyncThunk`.

**HTTP.** Everything goes through the `api` object in `src/api/client.ts`, which attaches the
`Authorization` header and implements 401 → refresh → retry → in-app logout. Never call
`fetch` directly, or you lose both. Every response uses the backend's envelope:
`{ status, status_code, message, data }`.

**Styling.** Tailwind v4 utilities plus the design tokens in `src/index.css`. Light values
live on `:root`, dark overrides under `.dark`; theming is `state.ui.theme` →
`classList.toggle('dark')`, with a pre-paint script in `index.html` so there is no flash on
load. Compose conditional classes with `cn()`. All ten themes are fully styled — don't
hard-code hex values or dark-only classes. `npm run themes` regenerates the per-theme blocks
from `src/features/ui/themes.ts`.

**Routing.** Route pages are `React.lazy`-loaded, so each is its own chunk and a screen may
suspend. `AppShell` supplies the `Suspense` fallback and a `RouteError` boundary.

**Tables and paging.** No feature writes `<table>` markup. Every table on every screen goes
through `components/DataTable.tsx`, which takes a column list — a header, a cell renderer and
an optional sort handle per column — and owns the caption, the `aria-sort` state, the row
animation and the pagination bar. `components/Pagination.tsx` is the one paging control, and
it is used directly by the lists that are not tables (the role cards).

Every list pages on the client: `lib/usePagination.ts` slices an array already in memory
(users, activity log, roles, permissions). A list that can grow to thousands of rows should
page on the server instead — the screen owns `page` and `offset` goes into the query — because
a page that only sliced the rows already downloaded would quietly answer a different question.
The arithmetic lives in `lib/pagination.ts` as pure functions, because the two things a
paginator gets wrong — the page that no longer exists after the list shrank, and the
"showing 41–50 of 47" that lies about the last page — are both arithmetic.

Every `<Pagination>` renders a `<nav>` landmark, so each instance needs a `label` that is
unique on its screen; the summary line is a `role="status"` live region, because paging swaps
the rows underneath without moving focus.

**Imports.** `@` aliases `src/`. Use it across features; relative imports are fine within a
feature.

## Tests

```bash
npm run test         # vitest run
npm run test:e2e     # auth, navigation, route content, theme, accessibility
```

Vitest + Testing Library + MSW for unit and component tests; Playwright for end-to-end, run
hermetically with `page.route` API mocking so no backend is needed. The a11y spec runs axe
over every route **and** every one of the ten themes, because colour contrast is the
highest-yield rule for a ten-palette design system and jsdom cannot compute it at all.

See [`src/test/README.md`](src/test/README.md) for what is covered and what is deliberately
not.

`npm run typecheck` is worth keeping in CI: `npm run build` uses esbuild, which strips
TypeScript types **without checking them**, so it will happily build code that does not
type-check.

## Bundle budget

`npm run build` prints a size table — one row per budget with the file's raw and gzip size,
its ceiling and the `headroom` left, then the total JS+CSS gzip against `totalGzipMax` — and
fails if a chunk exceeds its gzip ceiling in `bundle-budget.json`.

Read `headroom`: negative means the build just failed. Ceilings are a ratchet set just
above the measured value — **raising one is a deliberate decision that belongs in the
commit message**, never a silent edit, because a ceiling that drifts up on its own measures
nothing. A chunk over 50 kB gzip matching no budget entry is warned about rather than
ignored, since a new dependency in its own chunk is exactly what this catches.

## Dependency security

`.npmrc` sets `min-release-age=3`: nothing published in the last three days is installed,
which removes the day-zero window if a maintainer account is compromised. It applies to
resolution, so `npm ci` replaying the lockfile is unaffected. If it ever blocks a genuine
same-day security patch, npm keeps the old version, warns and exits non-zero — take the fix
with `npm install --min-release-age=0 <pkg>`, then restore the file.

`node scripts/check-audit.mjs` fails on any high or critical advisory that is **not** written
down in [docs/security-exceptions.md](docs/security-exceptions.md). The accepted ids are
parsed out of that document, so an exception cannot exist without its reasoning. There is
currently one, and it carries a large warning not to accept npm's suggested "fix" — a
semver-major router downgrade that buys nothing.

## Security headers

`nginx.conf` is the entire serving path — the Dockerfile copies it to
`/etc/nginx/conf.d/default.conf` and compose publishes the container directly, with no TLS
terminator in front. It sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy` and a hash-based `Content-Security-Policy`.

Two things to know before editing it:

- **`add_header` does not merge.** A `location` that defines any `add_header` stops
  inheriting the server-level ones completely, so the security headers are repeated in each
  of the three cache-controlled locations. Delete a repetition and they silently vanish from
  exactly those responses.
- **The CSP carries a `sha256-` hash of the one inline script** (the pre-paint theme block).
  `scripts/csp-hash.mjs` runs as `postbuild` and fails the build if the built HTML's hash is
  not in `script-src`. If you change that script, the build prints the new hash to paste in.
  A stale hash produces no error at runtime — the browser just refuses the script, and the
  symptom is a flash of the wrong theme.

`Strict-Transport-Security` is deliberately absent: this stack is plain HTTP, and HSTS on an
HTTP origin is ignored at best. Add it when TLS terminates in front of the container.

## Lint

Flat config in `eslint.config.mjs`: `@eslint/js` recommended, `typescript-eslint`
recommended, and the `eslint-plugin-react-hooks` rules — which are the reason it exists.

The violations that existed when the linter was introduced live in
`eslint-suppressions.json`, so `npm run lint` is green without a single disable comment.
**A new violation of any of those rules still fails**, so the gate is real from day one.

The file is a debt counter that should only shrink:

```bash
npx eslint . --prune-suppressions   # drop entries whose violation is gone
```

Run it after fixing anything it covers, and commit the smaller file. If you need a fresh
picture of what is still suppressed, `eslint-suppressions.json` is grouped by file and
rule and is meant to be read.

## Known gaps

- **No selector memoisation:** `createSelector` is used zero times.
- **`authSlice`'s async thunks are the largest untested surface** (~55% lines) and are the
  obvious next step for the coverage ratchet.

## License

Copyright 2026 SHAKTHIVEL RAVICHANDRAN.

Licensed under the [Apache License, Version 2.0](LICENSE). You may use, modify and
redistribute this software, including commercially, provided you retain the copyright
notice, state your changes, and include the [NOTICE](NOTICE) file. The license also
grants an explicit patent licence from every contributor.

The production bundle embeds third-party code. Any redistribution of `dist/` must carry
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) — minification strips the licence
banners those notices would otherwise live in. The full production dependency tree
(103 packages) is permissive; nothing in it is copyleft.

"Base Project" is a placeholder project name, not a licensed mark; Apache-2.0 grants no
trademark rights (§6).
