import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * A port from the environment, or the historical default.
 *
 * `pmt-api/scripts/dev.sh` exports both of these from the API's `.env`, because setup
 * moves a port whenever the default is already taken on the machine — 8080 and 8000 are
 * the two most contested ports a developer has. Hard-coding 8000 here meant the SPA came
 * up perfectly and then failed every request against a port with nothing behind it, which
 * reads as a broken backend rather than a moved one.
 *
 * A non-numeric or out-of-range value falls back rather than throwing: this file is also
 * loaded by `vitest` and by anything that imports the config, where a stray environment
 * variable should not be able to stop the build.
 */
export function portFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
}

export default defineConfig(() => {
    return {
      server: {
        port: portFromEnv(process.env.APP_DEV_PORT, 3000),
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: `http://localhost:${portFromEnv(process.env.API_PORT, 8000)}`,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/api/, ''),
          },
        },
      },
      plugins: [react(), tailwindcss()],
      // No `define` block, and no `loadEnv(mode, '.', '')`. Vite's `VITE_` prefix guard is
      // what keeps a non-public variable out of client code, and `define` is a raw text
      // substitution applied to every module in the graph including `node_modules` — so a
      // secret wired up here would be inlined into a public chunk by the first component
      // that wrote `process.env.API_KEY`, with no build error to catch it. Client code
      // holds no credentials of any kind; every secret lives only in the backend's
      // environment and never reaches a browser.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});
