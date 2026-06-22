// Unit tests for the colour / pulse maths embedded in index.html.
// The two pure helpers are extracted from the live index.html and executed,
// so these tests cover the actually-shipped code (not a copy). The inline
// formulas that aren't standalone functions are checked with a drift guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

// Pull a top-level `function name(...) { ... }` out of the inline <script> by
// brace-matching, then turn it into a callable function.
function extractFn(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, `function ${name} not found in index.html`);
  let depth = 0, end = -1;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) { end = i + 1; break; }
  }
  return new Function(html.slice(start, end) + '\nreturn ' + name + ';')();
}

const hslToHex = extractFn('hslToHex');
const darkenHexByLevel = extractFn('darkenHexByLevel');

test('hslToHex produces correct #rrggbb for primaries', () => {
  assert.match(hslToHex(0, 0.78, 0.55), /^#[0-9a-f]{6}$/);
  assert.equal(hslToHex(0, 1, 0.5), '#ff0000');
  assert.equal(hslToHex(120, 1, 0.5), '#00ff00');
  assert.equal(hslToHex(240, 1, 0.5), '#0000ff');
  assert.equal(hslToHex(0, 0, 0), '#000000');
  assert.equal(hslToHex(0, 0, 1), '#ffffff');
});

test('darkenHexByLevel scales every channel toward black', () => {
  assert.equal(darkenHexByLevel('#ffffff', 1), '#ffffff');   // level 1 → unchanged
  assert.equal(darkenHexByLevel('#ffffff', 0), '#000000');   // level 0 → black
  assert.equal(darkenHexByLevel('#ffffff', 0.5), '#808080');
  assert.equal(darkenHexByLevel('#ff0000', 0.5), '#800000');
  assert.equal(darkenHexByLevel('#3366cc', 1), '#3366cc');
});

// pulse maths (mirrors index.html; the drift guard below proves they match)
const pulseLow = intensity => 1 - (intensity / 100) * 0.95;
const pulseLevel = (phase, intensity) => {
  const low = pulseLow(intensity);
  return low + (1 - low) * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase));
};

test('pulseLow: 0% → no dimming (1.0), 50% → 0.525, 100% → 0.05 (full app depth)', () => {
  assert.equal(pulseLow(0), 1);
  assert.ok(Math.abs(pulseLow(50) - 0.525) < 1e-9);
  assert.ok(Math.abs(pulseLow(100) - 0.05) < 1e-9);
});

test('pulse level: trough at phase 0, full bright at phase 0.5', () => {
  assert.ok(Math.abs(pulseLevel(0, 100) - 0.05) < 1e-9);
  assert.ok(Math.abs(pulseLevel(0.5, 100) - 1.0) < 1e-9);
  assert.ok(Math.abs(pulseLevel(0, 50) - 0.525) < 1e-9);
  assert.ok(Math.abs(pulseLevel(0.5, 50) - 1.0) < 1e-9);
  assert.ok(Math.abs(pulseLevel(0.37, 0) - 1.0) < 1e-9);   // 0% intensity → flat, no pulse
});

test('index.html still contains the canonical effect formulas (drift guard)', () => {
  assert.ok(html.includes('hslToHex(hue, 0.78, 0.55)'), 'global-pulse colour');
  assert.ok(html.includes('0.5 - 0.5 * Math.cos(2 * Math.PI * phase)'), 'cosine pulse wave');
  assert.ok(html.includes('1 - (intensity / 100) * 0.95'), 'intensity → depth mapping');
  assert.ok(html.includes("'hsl(0,55%,88%)'"), 'illuminated particle palette');
  assert.ok(html.includes('30 * 60 * 1000'), '30-minute hue cycle');
});
