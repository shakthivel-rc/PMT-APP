import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * `React.lazy`, but a chunk that 404s after a deploy reloads the document once instead of
 * bricking the tab.
 *
 * The failure this exists for is routine, not exotic. `/assets/` is served
 * `immutable, max-age=1y` and `index.html` `no-cache`, which is the correct caching
 * strategy — but it means an already-open tab holds the *old* index.html and therefore the
 * old chunk hashes. After a deploy those hashes are gone from the server, so navigating to
 * a not-yet-loaded route makes an `import()` that 404s.
 *
 * And **React caches a rejected lazy payload permanently**: every subsequent read re-throws
 * the same error, with no built-in retry. So the error boundary's "Try again" — which only
 * clears boundary state and re-renders the same rejected element — could never succeed. A
 * user could sit in that state indefinitely, since logout here is fully in-app and nothing
 * in the SPA ever calls `location.reload()`.
 *
 * The `sessionStorage` guard is not optional. Without it a genuinely missing chunk (a
 * broken deploy, not a stale tab) becomes an infinite reload loop, which is strictly worse
 * than the bug being fixed. One reload fixes the common case; the second failure surfaces
 * the real error to the boundary.
 */
export const chunkReloadFlag = (key: string) => `nx-chunk-reload:${key}`;

/** Matches the message browsers use for a module script that could not be fetched. */
export const isChunkLoadError = (err: unknown): boolean => {
  const message = (err as { message?: string })?.message ?? '';
  return /dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically imported module/i.test(
    message,
  );
};

/**
 * The behaviour, separated from `lazy()` so it can be tested without reaching into React's
 * lazy payload internals.
 */
export async function importWithChunkReload<T>(
  factory: () => Promise<T>,
  key: string,
): Promise<T> {
  const flag = chunkReloadFlag(key);
  try {
    const mod = await factory();
    // Cleared on success so a *later* deploy is allowed its own single reload.
    sessionStorage.removeItem(flag);
    return mod;
  } catch (err) {
    if (isChunkLoadError(err) && !sessionStorage.getItem(flag)) {
      sessionStorage.setItem(flag, '1');
      window.location.reload();
      // Never resolves: the reload takes over, and returning anything here would render a
      // half-torn-down tree in the interim.
      await new Promise<never>(() => {});
    }
    throw err;
  }
}

export function lazyWithRetry<
  // Mirrors React's own `lazy<T extends ComponentType<any>>`. Narrowing it (to `unknown` or
  // `never`) fails the constraint by variance and makes every call site an error, so the
  // `any` is the upstream signature rather than a shortcut.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends ComponentType<any>,
>(factory: () => Promise<{ default: T }>, key: string): LazyExoticComponent<T> {
  return lazy(() => importWithChunkReload(factory, key));
}
