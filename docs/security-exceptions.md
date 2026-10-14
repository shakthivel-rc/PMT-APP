# Accepted security advisories

Advisories that `npm audit` reports and that this project has deliberately **not** fixed,
with the reasoning. `scripts/check-audit.mjs` reads the ids out of this file, so an entry
here is what makes that audit gate pass — adding one is a decision, not paperwork. The gate
runs locally; no CI workflow runs it yet.

Every entry must say: why it is not reachable, **what would make it reachable**, what the
real fix is, and when to look again.

---

## GHSA-qwww-vcr4-c8h2 — react-router RSC Mode CSRF Bypass

- **Status:** accepted — not reachable
- **Severity:** high (CWE-352)
- **Affects:** `react-router` >= 7.12.0 < 8.3.0, and `react-router-dom` transitively
- **Installed:** react-router-dom 7.18.2
- **Accepted:** 2026-08-07 · **Review by:** 2026-11-07

### Why it is not reachable

The advisory states it "only affects your application if you are using the unstable RSC
APIs". This app uses none of them:

```
$ grep -rn "createBrowserRouter\|RouterProvider\|BrowserRouter\|unstable_\|@react-router/\|react-router/rsc\|createStaticHandler" src/
src/index.tsx:4:import { BrowserRouter } from 'react-router-dom';
src/index.tsx:26:      <BrowserRouter>
src/index.tsx:28:      </BrowserRouter>
```

Three hits, all declarative `<BrowserRouter>`. There is no data router, no
`createStaticHandler`, no RSC entry point, and no `@react-router/*` server package anywhere
in the dependency tree.

### What would revoke this acceptance

Any of: `createBrowserRouter`, `RouterProvider`, a `loader`/`action` route definition, an
`unstable_*` import, an `@react-router/*` package, or an RSC entry point. If you are adding
any of those, delete this entry and take the real fix first.

### The real fix

**react-router 8.3.0.** There is no forward fix on the 7.x line — 7.18.2 is the latest 7.x
and is still inside the vulnerable range. The v8 upgrade needs the `react-router-dom` →
`react-router` import rename, React >= 19.2.7 and Node >= 22.22 (the last is already
satisfied by `.nvmrc`).

### ⚠️ Never take npm's suggested fix

```
fixAvailable: {"name":"react-router-dom","version":"7.11.0","isSemVerMajor":true}
```

`npm audit fix --force` would **downgrade the whole router by a major version** — onto an
app whose entire routing layer (the lazy app and auth routes, the `ProtectedShell`/`PublicOutlet`
guards, the emailed-link routes `/reset-password` and `/verify-account` that read `?token=`
through `useSearchParams`) is written against v7 APIs. It trades a
real regression risk for **zero** security benefit, because the vulnerable code path is not
reachable here either way. Anyone reading "high severity, fix available" literally will take
it; that is what this file exists to prevent.
