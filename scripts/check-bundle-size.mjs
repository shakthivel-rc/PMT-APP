#!/usr/bin/env node
/**
 * Print the shipped bundle's size table on every build, and fail when a chunk exceeds its
 * budget in `bundle-budget.json`.
 *
 * The gate chain built this bundle and never looked at it: typecheck -> coverage -> build ->
 * e2e, with nothing measuring the output, so a size regression shipped silently. This is not here
 * because the bundle is bad — the initial JS sits between the 10th and 25th percentile of
 * the crawled web, and comfortably under web.dev's 300 kB desktop JS line. It is here
 * because nothing noticed when it *changed*, and changes like code-splitting the auth
 * screens, self-hosting Inter or the Vite 8 bump all turn on a measured before/after.
 *
 * gzip, not brotli: nginx.conf enables gzip only, so gzip is what this deployment actually
 * ships. Sizes are computed in memory — no dependency, no analyzer, same `postbuild` slot
 * and same shape as `check-asset-extensions.mjs`.
 *
 * Ceilings are a ratchet, exactly like the coverage thresholds in `vitest.config.ts`: each
 * one sits just above the measured value, and raising one is a deliberate decision that
 * belongs in a commit message, never a silent edit.
 */
import { gzipSync } from 'zlib';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(new URL('../', import.meta.url)));
const DIST = join(ROOT, 'dist');

/**
 * An unmatched chunk this large is reported rather than ignored. A new dependency landing
 * in its own chunk is exactly the regression this script exists to catch, and it would
 * match no budget entry by construction.
 */
const UNMATCHED_WARN_GZIP = 50_000;

/** `assets/index-*.js` — the only glob shape the budget file needs. */
const matches = (pattern, file) =>
  new RegExp(`^${pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(file);

const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;

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

let budget;
try {
  budget = JSON.parse(readFileSync(join(ROOT, 'bundle-budget.json'), 'utf8'));
} catch {
  console.error('check-bundle-size: bundle-budget.json is missing or unreadable.');
  process.exit(1);
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error('check-bundle-size: no dist/ to check — run `npm run build` first.');
  process.exit(1);
}

// Only JS and CSS are measured; source maps are not served to users.
const measured = files
  .filter((file) => /\.(js|css)$/.test(file) && !file.endsWith('.map'))
  .map((file) => {
    const raw = readFileSync(join(DIST, file));
    return { file, raw: raw.length, gzip: gzipSync(raw, { level: 9 }).length };
  })
  .sort((a, b) => b.gzip - a.gzip);

const totalGzip = measured.reduce((sum, entry) => sum + entry.gzip, 0);
const breaches = [];
const rows = [];
const matchedFiles = new Set();

for (const entry of budget.budgets) {
  const hits = measured.filter((m) => matches(entry.match, m.file));
  if (hits.length === 0) {
    // A budget that matches nothing is a budget that is not protecting anything — usually
    // a chunk that was renamed. Say so rather than passing quietly.
    breaches.push(`${entry.label}: no built file matches "${entry.match}" — the budget is not being applied.`);
    continue;
  }
  for (const hit of hits) {
    matchedFiles.add(hit.file);
    const headroom = entry.maxGzip - hit.gzip;
    rows.push([entry.label, hit.file, kb(hit.raw), kb(hit.gzip), kb(entry.maxGzip), `${headroom >= 0 ? '+' : ''}${kb(headroom)}`]);
    if (headroom < 0) {
      breaches.push(`${entry.label} (${hit.file}) is ${kb(hit.gzip)} gzip, over its ${kb(entry.maxGzip)} budget by ${kb(-headroom)}.`);
    }
  }
}

const unmatched = measured.filter((m) => !matchedFiles.has(m.file) && m.gzip >= UNMATCHED_WARN_GZIP);

const headers = ['budget', 'file', 'raw', 'gzip', 'ceiling', 'headroom'];
const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
const line = (cells) => cells.map((c, i) => (i <= 1 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ');

console.log('\ncheck-bundle-size:');
console.log('  ' + line(headers));
for (const row of rows) console.log('  ' + line(row));
console.log(`  total JS+CSS gzip: ${kb(totalGzip)} / ${kb(budget.totalGzipMax)} ceiling`);

if (totalGzip > budget.totalGzipMax) {
  breaches.push(`total JS+CSS is ${kb(totalGzip)} gzip, over the ${kb(budget.totalGzipMax)} ceiling.`);
}

for (const entry of unmatched) {
  console.warn(`  ! ${entry.file} is ${kb(entry.gzip)} gzip and matches no budget entry — add one or confirm it is expected.`);
}

if (breaches.length > 0) {
  console.error(
    '\ncheck-bundle-size: budget exceeded.\n' +
      breaches.map((b) => `  ${b}`).join('\n') +
      '\n\nEither reduce the chunk or raise the ceiling in bundle-budget.json deliberately, ' +
      'saying why in the commit message. A ceiling that drifts up on its own measures nothing.',
  );
  process.exit(1);
}

console.log('  all chunks within budget.\n');
