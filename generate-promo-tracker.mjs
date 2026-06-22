import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const QRCode = require('qrcode');

// index.html is the single source of truth for markup/CSS/JS.
// This script ONLY refreshes the data baked into it — the QR/APP_DATA blob,
// the per-app <section> containers, and the header total — leaving everything
// else untouched. Edit index.html directly; run this to re-bake the data.

const promos = JSON.parse(readFileSync('./data/promos.json', 'utf-8'));

// Group by app (insertion order preserved → deterministic output)
const byApp = {};
for (const p of promos) {
  (byApp[p.app] ||= []).push(p);
}

// Generate QR SVGs for all codes
console.log(`Generating QR codes for ${promos.length} codes…`);
const svgs = await Promise.all(promos.map(p =>
  QRCode.toString(p.url, { type: 'svg', width: 160, margin: 1, color: { dark: '#111827', light: '#ffffff' } })
));
const cleanSvg = s => s.replace(/<\?xml[^>]*\?>\s*/g, '').replace(/\n/g, ' ').trim();
promos.forEach((p, i) => { p._svg = cleanSvg(svgs[i]); });

// Build per-app data blobs (without _svg leaking cross-app)
const appData = {};
for (const [app, codes] of Object.entries(byApp)) {
  appData[app] = codes.map(p => ({
    code: p.code,
    description: p.description || '',
    url: p.url,
    givenTo: p.givenTo || null,
    svg: p._svg,
  }));
}

const totalCodes = promos.length;
const totalApps = Object.keys(byApp).length;
const slug = app => app.replace(/\s+/g, '-').toLowerCase();

const appSectionsHtml = Object.keys(byApp).map(app => `
  <section class="app-section" id="app-${slug(app)}">
    <h2 class="app-name">${app}</h2>
    <div class="stats" id="stats-${slug(app)}"></div>
    <div class="grid" id="grid-${slug(app)}"></div>
  </section>`).join('');

// ── Inject the data regions into index.html in place ──────────────────
let html = readFileSync('./index.html', 'utf-8');

const regions = [
  ['APP_DATA',  /const APP_DATA = [^\n]*;/,        () => `const APP_DATA = ${JSON.stringify(appData)};`],
  ['sections',  /<main>[\s\S]*?<\/main>/,          () => `<main>${appSectionsHtml}\n</main>`],
  ['total',     /(id="g-total">)\d+( total<)/,     (_, a, b) => `${a}${totalCodes}${b}`],
];

for (const [name, re, replacer] of regions) {
  if (!re.test(html)) {
    throw new Error(`index.html is missing the ${name} region — aborting so we don't ship stale data. Did the markup change?`);
  }
  html = html.replace(re, replacer);
}

writeFileSync('./index.html', html, 'utf-8');
console.log(`Refreshed index.html — ${totalCodes} codes across ${totalApps} app(s).`);
