#!/usr/bin/env node
/**
 * Fail the build if `dist/` contains an asset whose extension a plain static host will
 * not recognise.
 *
 * This exists because of one real outage. A dependency emitted a worker as `.mjs`;
 * nginx's bundled `mime.types` has no entry for that extension, so it went out as
 * `application/octet-stream`; browsers refuse to execute a module script served as
 * anything but JavaScript; and the screen that lazy-loaded it was simply dead. Every
 * symptom pointed at a missing file — the request was a 200 with the right bytes, and
 * only the Content-Type was wrong. (That dependency is gone; the check is not, because
 * the next one to emit an `.mjs` would fail the same way.)
 *
 * The check runs as `postbuild` rather than in the test suite because it is a statement
 * about build *output*, and nothing in this repository decides that on its own: a
 * dependency, a plugin or a future Vite default can emit an unservable name with no file
 * here ever being touched. Failing here costs a second; the same mistake found in
 * production costs a rebuild, a redeploy, and — because asset URLs are content-hashed and
 * served `immutable` — a year of poisoned browser caches that the redeploy does not
 * reach.
 *
 * Adding an extension to the allow-list is a deliberate decision: it means checking that
 * the deployment target actually maps it. `nginx.conf` is the target that matters here.
 */
import { readdirSync, statSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

const DIST = join(fileURLToPath(new URL('../', import.meta.url)), 'dist');

/**
 * Extensions nginx's bundled `mime.types` maps, restricted to the ones this app can
 * plausibly emit. `.mjs` is deliberately absent — that is the whole point of the check.
 */
const SERVABLE = new Set([
  '.html',
  '.js',
  '.css',
  '.json',
  '.map', // served as JSON/octet-stream, never executed — devtools fetches it explicitly
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.txt',
  '.wasm',
  '.webmanifest',
]);

/** Every file under `dir`, as paths relative to `dist/`. */
function walk(dir, base = '') {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const relative = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) found.push(...walk(full, relative));
    else found.push(relative);
  }
  return found;
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error('check-asset-extensions: no dist/ to check — run `npm run build` first.');
  process.exit(1);
}

const offenders = files.filter((file) => !SERVABLE.has(extname(file).toLowerCase()));

if (offenders.length > 0) {
  console.error(
    `check-asset-extensions: ${offenders.length} built file(s) use an extension that ` +
      'nginx (and most static hosts) will serve as application/octet-stream:\n' +
      offenders.map((file) => `  dist/${file}`).join('\n') +
      '\n\nA script served with the wrong Content-Type is refused by the browser, and a ' +
      'content-hashed URL served `immutable` keeps that refusal cached long after the ' +
      'server is fixed. Rename it with an `assetFileNames` override in vite.config.ts, ' +
      'or add the extension here once nginx.conf is known to map it.',
  );
  process.exit(1);
}

console.log(`check-asset-extensions: ${files.length} built files, all servable.`);
