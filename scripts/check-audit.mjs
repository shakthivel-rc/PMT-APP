#!/usr/bin/env node
/**
 * Fail on any high-or-critical `npm audit` finding that is not written down in
 * `docs/security-exceptions.md`.
 *
 * The accepted ids are parsed out of that document rather than listed here, so an exception
 * cannot exist without its reasoning. A bare `--audit-level=high` would be permanently red
 * (there is one accepted advisory), and a permanently red gate is worse than no gate: it
 * gets ignored, or it gets "fixed" by taking npm's suggested react-router downgrade — which
 * is a semver-major backwards jump that buys nothing. See the exceptions file.
 */
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(new URL('../', import.meta.url)));
const BLOCKING = new Set(['high', 'critical']);

const doc = readFileSync(join(ROOT, 'docs', 'security-exceptions.md'), 'utf8');
// GHSA ids and numeric npm advisory ids, from the `## <id> — title` headings only, so a
// mention in prose cannot silently accept something.
const accepted = new Set(
  [...doc.matchAll(/^##\s+(GHSA-[\w-]+|\d{4,})\b/gm)].map((m) => m[1]),
);

// `npm audit` exits non-zero when it finds anything, so the failure is not the error here.
let report;
try {
  report = execFileSync('npm', ['audit', '--json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
} catch (err) {
  report = err.stdout;
}

let parsed;
try {
  parsed = JSON.parse(report);
} catch {
  console.error('check-audit: could not parse `npm audit --json` output.');
  process.exit(1);
}

/** Every advisory id reachable from a package's `via` chain, resolved through linked entries. */
const idsFor = (name, seen = new Set()) => {
  if (seen.has(name)) return [];
  seen.add(name);
  const entry = parsed.vulnerabilities?.[name];
  if (!entry) return [];
  return entry.via.flatMap((via) =>
    typeof via === 'string' ? idsFor(via, seen) : [String(via.source), ...(via.url?.match(/GHSA-[\w-]+/) ?? [])],
  );
};

const unexplained = [];
for (const [name, entry] of Object.entries(parsed.vulnerabilities ?? {})) {
  if (!BLOCKING.has(entry.severity)) continue;
  const ids = idsFor(name);
  if (ids.some((id) => accepted.has(id))) continue;
  unexplained.push(`${name} (${entry.severity}) — ${ids.join(', ') || 'no advisory id reported'}`);
}

const counts = parsed.metadata?.vulnerabilities ?? {};
console.log(
  `check-audit: ${counts.critical ?? 0} critical, ${counts.high ?? 0} high, ` +
    `${counts.moderate ?? 0} moderate, ${counts.low ?? 0} low; ` +
    `${accepted.size} accepted in docs/security-exceptions.md.`,
);

if (unexplained.length > 0) {
  console.error(
    '\ncheck-audit: high-or-critical advisories with no recorded exception:\n' +
      unexplained.map((u) => `  ${u}`).join('\n') +
      '\n\nFix it, or add an entry to docs/security-exceptions.md saying why it is not ' +
      'reachable, what would make it reachable, and what the real fix is. Do not add an ' +
      'entry you cannot answer those three questions for.',
  );
  process.exit(1);
}

console.log('check-audit: nothing unexplained.');
