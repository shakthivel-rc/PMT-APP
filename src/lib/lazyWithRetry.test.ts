import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chunkReloadFlag, importWithChunkReload, isChunkLoadError } from '@/lib/lazyWithRetry';

const chunkError = () =>
  new Error('Failed to fetch dynamically imported module: /assets/UserProfile-abc123.js');

// `lazyWithRetry` is `lazy(() => importWithChunkReload(...))`; the behaviour lives in the
// latter, so it is tested directly rather than by reaching into React's lazy payload.

let reload: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessionStorage.clear();
  reload = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isChunkLoadError', () => {
  it('recognises the messages browsers actually use', () => {
    expect(isChunkLoadError(chunkError())).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk 42 failed'))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
  });

  it('does not claim an ordinary render error', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('importWithChunkReload', () => {
  it('passes the module through untouched when the import succeeds', async () => {
    const mod = { default: () => null };

    await expect(importWithChunkReload(async () => mod, 'Ok')).resolves.toBe(mod);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads the document once when a chunk 404s after a deploy', async () => {
    // The promise deliberately never settles — the reload takes over, and resolving would
    // render a half-torn-down tree in the interim.
    const pending = importWithChunkReload(() => Promise.reject(chunkError()), 'UserProfile');
    const settled = await Promise.race([pending.then(() => 'settled', () => 'settled'), Promise.resolve('pending')]);

    expect(settled).toBe('pending');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(chunkReloadFlag('UserProfile'))).toBe('1');
  });

  it('does not loop: a second failure in the same session surfaces the error', async () => {
    // Without this guard a genuinely broken deploy becomes an infinite reload loop, which
    // is strictly worse than the bug being fixed.
    sessionStorage.setItem(chunkReloadFlag('UserProfile'), '1');

    await expect(importWithChunkReload(() => Promise.reject(chunkError()), 'UserProfile')).rejects.toThrow(
      /dynamically imported module/,
    );
    expect(reload).not.toHaveBeenCalled();
  });

  it('never reloads for an ordinary module error', async () => {
    await expect(importWithChunkReload(() => Promise.reject(new Error('boom')), 'Other')).rejects.toThrow(
      'boom',
    );
    expect(reload).not.toHaveBeenCalled();
  });

  it('clears the flag on success so a later deploy gets its own reload', async () => {
    sessionStorage.setItem(chunkReloadFlag('UserProfile'), '1');

    await importWithChunkReload(async () => ({ default: () => null }), 'UserProfile');

    expect(sessionStorage.getItem(chunkReloadFlag('UserProfile'))).toBeNull();
  });
});
