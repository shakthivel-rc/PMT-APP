#!/usr/bin/env node
/**
 * Compute the CSP `sha256-` hash of the one inline script in `dist/index.html`, and fail
 * the build if `nginx.conf`'s `script-src` no longer carries it.
 *
 * This app is unusually cheap to protect with a strict CSP because it has exactly one
 * inline script — the pre-paint theme block — which is why a *hash*-based policy works
 * here at all. web.dev routes statically served SPAs to hashes precisely because there is
 * no per-request server to mint a nonce, which is this deployment exactly.
 *
 * The check exists because the failure mode is silent and severe: a stale hash means the
 * browser refuses the theme script, and the symptom is a flash of the wrong theme (or, if
 * the policy tightens further, a blank page) discovered in production rather than a build
 * error here. The hash is computed from the *built* HTML, not the source, because Vite may
 * transform what ends up inline.
 *
 * When the script legitimately changes, this prints the new hash to paste into nginx.conf.
 */
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(new URL('../', import.meta.url)));

const html = (() => {
  try {
    return readFileSync(join(ROOT, 'dist', 'index.html'), 'utf8');
  } catch {
    console.error('csp-hash: no dist/index.html — run `npm run build` first.');
    process.exit(1);
  }
})();

// Inline scripts only: a `<script src=…>` is covered by `'self'`, not by a hash.
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

if (inline.length === 0) {
  console.error('csp-hash: no inline <script> found in dist/index.html — has the theme block moved?');
  process.exit(1);
}

// The hash is over the exact bytes between the tags, with no trimming — that is what the
// browser hashes, and trimming here would produce a hash that never matches.
const hashes = inline.map((body) => `sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}`);

const nginx = readFileSync(join(ROOT, 'nginx.conf'), 'utf8');
const missing = hashes.filter((h) => !nginx.includes(h));

if (missing.length > 0) {
  console.error(
    `csp-hash: nginx.conf's Content-Security-Policy does not carry ${missing.length} inline-script ` +
      `hash(es) from the built index.html:\n` +
      missing.map((h) => `  '${h}'`).join('\n') +
      "\n\nAdd them to the script-src directive in nginx.conf. A stale hash is not an error at " +
      'runtime — the browser silently refuses the script, and the symptom is a flash of the ' +
      'wrong theme rather than anything that looks like a CSP problem.',
  );
  process.exit(1);
}

console.log(`csp-hash: ${hashes.length} inline script hash(es) present in nginx.conf.`);
