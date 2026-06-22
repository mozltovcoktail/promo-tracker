// Integration tests for the in-place build (generate-promo-tracker.mjs).
// The generator must only re-bake the data regions of index.html and never
// clobber the hand-written markup/CSS/JS — that bug is what this whole change
// set out to fix, so it's guarded here.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = join(root, 'index.html');
const ORIGINAL = readFileSync(indexPath, 'utf8');
const run = () => execFileSync('node', ['generate-promo-tracker.mjs'], { cwd: root, stdio: 'pipe' });

after(() => writeFileSync(indexPath, ORIGINAL)); // always leave index.html as committed

test('generator is idempotent and the committed index.html equals a fresh build', () => {
  run();
  const a = readFileSync(indexPath, 'utf8');
  run();
  const b = readFileSync(indexPath, 'utf8');
  assert.equal(a, b, 'two runs are byte-identical (idempotent)');
  assert.equal(a, ORIGINAL, 'committed index.html already matches a fresh re-bake');
});

test('re-bake fills the three data regions and leaves the app untouched', () => {
  run();
  const out = readFileSync(indexPath, 'utf8');
  assert.match(out, /const APP_DATA = \{/, 'APP_DATA blob');
  assert.match(out, /<main>[\s\S]*<section class="app-section"[\s\S]*<\/main>/, 'app sections');
  assert.match(out, /id="g-total">\d+ total</, 'header total');
  for (const marker of ['launchIlluminated', 'darkenHexByLevel', 'pulse-switch-input', 'clamp(260px,']) {
    assert.ok(out.includes(marker), `effect/layout code preserved: ${marker}`);
  }
});

test('generator aborts instead of shipping stale data when a region is missing', () => {
  // Corrupt the APP_DATA region; the generator must throw rather than silently skip it.
  writeFileSync(indexPath, ORIGINAL.replace(/const APP_DATA = [^\n]*;/, 'const APP_DATA_RENAMED = 1;'));
  assert.throws(run, 'missing APP_DATA region should abort the build');
  writeFileSync(indexPath, ORIGINAL);
});
