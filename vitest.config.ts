/// <reference types="vitest/config" />
import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Dedicated Vitest config. It intentionally reuses vite.config.ts's `@`→src alias and
// the React plugin, but drops the Tailwind plugin (unnecessary in jsdom and slow) and
// the dev proxy/`define` block (tests mock the network via MSW).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    clearMocks: true,
    restoreMocks: true,
    // 15s rather than Vitest's 5s: headroom, not a measurement of this suite.
    //
    // The worst single test here takes about 1.3-1.6s, with or without coverage (measured
    // 2026-09-28; the UserTable, UserModal and DashboardClient specs), so today the default
    // would pass. The margin is for the page-level specs a derived project adds: a spec that
    // drives a whole screen through MSW with a dozen `userEvent` interactions per test reached
    // ~4.8s under coverage in the product this base was cut from, and past 5s it fails with
    // "Test timed out", which reads as a hang in a component rather than as a slow runner.
    //
    // A genuine hang still fails in 15s rather than sitting for a minute. If a test needs
    // more than this, it is doing too much.
    testTimeout: 15_000,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Playwright specs live in e2e/ and must never be picked up by Vitest.
    exclude: ['node_modules', 'dist', 'e2e', '.idea', '.git', '.cache'],
    reporters: process.env.CI
      ? ['default', ['junit', { outputFile: 'reports/vitest-junit.xml' }]]
      : ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      // Scope coverage to the logic we deliberately test so the number is meaningful
      // rather than diluted by presentational shells and route screens.
      include: [
        'src/lib/**',
        'src/config/**',
        'src/types/**',
        'src/api/**',
        'src/actions/**',
        'src/features/**/*Slice.ts',
        'src/components/**',
      ],
      exclude: [
        'src/components/ui/**', // shadcn/radix copy-in primitives — not our code to test
        'src/components/layout/**', // app-shell chrome, exercised by E2E instead
        'src/test/**',
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        'src/index.tsx',
      ],
      // Ratcheting floors: each sits ~1 point under the measured figure, so coverage can
      // only go up — close enough that one untested addition trips it, far enough that a
      // normal refactor does not. Raise them as coverage grows, and re-measure whenever a
      // module is removed wholesale: a floor calibrated against code that no longer exists
      // either fails for no reason or drifts below reality, and a floor nothing can fail is
      // not a ratchet. Never lower one to make a change pass. `npm run verify` (which the
      // API repo's `make verify-app` wraps) is what enforces them, and no CI workflow runs it
      // yet — it is a local gate, so drift is visible the day it starts only if it is run
      // before every push.
      //
      // Re-measured 2026-09-28 after the base-project conversion removed the original
      // product's domain pages, slices and API modules, and again the same day once review
      // added the PUT/PATCH body cases to client.test.ts (49 files, 398 tests): lines 91.05%,
      // statements 91.05%, functions 95.77%, branches 90.71-91.05% (the branch figure moves
      // between identical runs: DataTable.tsx's branch count is not stable run to run). Each
      // floor now sits ~1 point under its figure, branches under the lower reading. Lines
      // and branches fell (from 92.87% / 92.28%) mainly because the removed modules were
      // among the best-covered in the suite — about 95% of their lines — so what remains
      // averages lower. The previous floors were calibrated against them.
      //
      // The largest gap is `src/features/auth/authSlice.ts` (about 55% lines) — the async
      // thunks. That is where the next real point comes from, and it is worth more than
      // the number: it is the sign-in path.
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 94.75,
        branches: 90,
      },
    },
  },
});
