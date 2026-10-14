import { Loader2 } from 'lucide-react';

/** Suspense fallback for route-level lazy/`use()` loading. */
const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
    <Loader2 className="size-7 animate-spin text-primary" />
    <span className="sr-only">Loading…</span>
  </div>
);

export default PageLoader;
