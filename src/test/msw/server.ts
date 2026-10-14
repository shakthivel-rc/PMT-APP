import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Shared MSW server for the whole Vitest run (started/stopped in src/test/setup.ts).
// Individual tests refine behaviour with `server.use(...)`.
export const server = setupServer(...handlers);
