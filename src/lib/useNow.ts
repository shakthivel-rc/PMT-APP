import { useSyncExternalStore } from 'react';

/*
 * One shared one-second clock for everything that ticks (the header timer, the drawer's timer
 * button). Reading `Date.now()` during render is impure and the `react-hooks/purity` rule
 * refuses it; an external store read through `useSyncExternalStore` is the sanctioned way to
 * let a component see the time change. One interval serves every subscriber and stops when the
 * last one leaves, so a screen with no running timer runs no timer.
 *
 * Elapsed time is always computed from timestamps, never by counting ticks: a background tab
 * throttles intervals (to once a minute after five hidden minutes, in Chrome), and a counter
 * would fall behind while a subtraction just catches up on the next tick.
 */

const listeners = new Set<() => void>();
let interval: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  interval ??= setInterval(() => listeners.forEach((notify) => notify()), 1000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(interval);
      interval = undefined;
    }
  };
}

/** Now, in whole epoch seconds. Whole, so the snapshot is stable within a second. */
export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/** Re-renders the calling component once a second with the current epoch second. */
export function useNowSeconds(): number {
  return useSyncExternalStore(subscribe, nowSeconds, nowSeconds);
}
