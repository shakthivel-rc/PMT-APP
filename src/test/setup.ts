import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw/server';

// ---------------------------------------------------------------------------
// jsdom polyfills — MUST be installed before any store/slice import, because
// features/ui/uiSlice.ts calls window.matchMedia() at module-evaluation time
// while computing its initialState. jsdom ships none of the APIs below.
// ---------------------------------------------------------------------------
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated, kept for older consumers
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// Radix primitives rely on these; jsdom omits them.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = vi.fn();
if (!Element.prototype.hasPointerCapture)
  Element.prototype.hasPointerCapture = vi.fn(() => false);
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = vi.fn();
if (!Element.prototype.releasePointerCapture)
  Element.prototype.releasePointerCapture = vi.fn();

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn((blob: Blob) => `blob:mock-url-${blob?.size ?? 0}`);
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = vi.fn();
}

// ---------------------------------------------------------------------------
// MSW lifecycle — unhandled requests error out so a test can never silently
// hit the real network. Per-test overrides go through server.use(...).
// ---------------------------------------------------------------------------
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  server.resetHandlers();
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

afterAll(() => server.close());
