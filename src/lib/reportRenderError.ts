/**
 * The app's render-error seam.
 *
 * React 19 added three root-level handlers and `createRoot(el)` with no options dropped all
 * three signals on the floor. The practical state was: a render crash in production showed
 * "Couldn't load this page" and **no record existed anywhere** — the app has exactly one
 * error boundary, mounted in `AppShell` around the routed outlet, so the provider tree and
 * every public auth screen had none at all, and there is no error-tracking service.
 *
 * React 19 also consolidated duplicate reporting: previously a caught error was thrown
 * twice and then `console.error`'d, "resulting in three errors for every caught error", so
 * these handlers are also how you get one clean report instead of three noisy ones.
 *
 * This is deliberately the shape an error-tracking SDK plugs into — one function, three
 * call sites, a `kind` discriminator — so adopting one later is a change here and nowhere
 * else. It mirrors `setUnauthorizedHandler` in `src/api/client.ts`, the app's other
 * "something went wrong" registration seam.
 */

export type RenderErrorKind = 'caught' | 'uncaught' | 'recoverable';

type Reporter = (kind: RenderErrorKind, error: unknown, componentStack: string | null) => void;

let reporter: Reporter | null = null;

/** Registers an external reporter (an error-tracking SDK, or a test double). */
export function setRenderErrorReporter(next: Reporter | null): void {
  reporter = next;
}

/**
 * Errors React reports that are not actionable and not the app's fault.
 *
 * Kept as an explicit list rather than a broad `catch`: a filter nobody can enumerate is
 * indistinguishable from no reporting at all.
 */
const IGNORED = [
  // Fires when a `useSyncExternalStore` snapshot changes between render and commit during
  // a hydration-free client render; React recovers by re-rendering.
  'Minified React error #418',
];

const isIgnored = (message: string) => IGNORED.some((known) => message.includes(known));

export function reportRenderError(
  kind: RenderErrorKind,
  error: unknown,
  errorInfo?: { componentStack?: string | null },
): void {
  const message = error instanceof Error ? error.message : String(error);
  if (isIgnored(message)) return;

  const componentStack = errorInfo?.componentStack ?? null;
  reporter?.(kind, error, componentStack);

  // Until a tracker is adopted, the console is the record — but a *labelled* one, so a
  // recoverable warning is not mistaken for a crash and vice versa.
  const label = `[render:${kind}]`;
  if (kind === 'recoverable') {
    console.warn(label, error, componentStack ?? '');
  } else {
    console.error(label, error, componentStack ?? '');
  }
}
