import { useEffect, useState } from 'react';

/*
 * Load once per key; the answer is kept with the key it answers, so a slow answer for the
 * previous key is never shown as the current one, and "loading" is derived rather than set
 * in an effect. The same helper as the timesheet's (features/time/components/Timesheet.tsx).
 */

export interface Keyed<T> {
  key: string;
  data?: T;
  error?: string;
}

export const errorMessage = (err: unknown) =>
  err instanceof Error && err.message ? err.message : 'Something went wrong. Try again.';

export function useKeyed<T>(key: string | null, load: () => Promise<T>): Keyed<T> | null {
  const [state, setState] = useState<Keyed<T> | null>(null);
  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    load().then(
      (data) => !cancelled && setState({ key, data }),
      (err: unknown) => !cancelled && setState({ key, error: errorMessage(err) }),
    );
    return () => {
      cancelled = true;
    };
    // `load` closes over exactly what `key` spells out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state && state.key === key ? state : null;
}
