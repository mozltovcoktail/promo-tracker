import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const QRCode = require('qrcode');

const promos = JSON.parse(readFileSync('./data/promos.json', 'utf-8'));

// Group by app
const byApp = {};
for (const p of promos) {
  if (!byApp[p.app]) byApp[p.app] = [];
  byApp[p.app].push(p);
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

const appSectionsHtml = Object.keys(byApp).map(app => `
  <section class="app-section" id="app-${app.replace(/\s+/g, '-').toLowerCase()}">
    <h2 class="app-name">${app}</h2>
    <div class="stats" id="stats-${app.replace(/\s+/g, '-').toLowerCase()}"></div>
    <div class="grid" id="grid-${app.replace(/\s+/g, '-').toLowerCase()}"></div>
  </section>`).join('');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Promo Tracker</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0f;
    --surface: #13131a;
    --surface2: #1c1c28;
    --border: #2a2a3a;
    --accent: #7c6af7;
    --green: #22c55e;
    --green-bg: #14532d30;
    --red: #f87171;
    --red-bg: #7f1d1d30;
    --text: #e8e8f0;
    --muted: #6b6b80;
    --font: 'DM Sans', system-ui, sans-serif;
  }

  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
  }

  .header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(10,10,15,0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 12px 20px;
  }

  .header-top {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .logo {
    font-size: 18px;
    font-weight: 700;
    background: linear-gradient(90deg,#f87171,#fb923c,#fbbf24,#4ade80,#60a5fa,#a78bfa,#f472b6,#f87171);
    background-size: 300% 100%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: rainbow 5s linear infinite;
    white-space: nowrap;
  }

  @keyframes rainbow {
    0%   { background-position: 0% 50% }
    100% { background-position: 300% 50% }
  }

  .global-stats {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-left: 4px;
  }

  .stat {
    font-size: 12px;
    padding: 3px 9px;
    border-radius: 20px;
    font-weight: 500;
  }
  .stat-total { background: var(--surface2); color: var(--muted); }
  .stat-avail { background: var(--green-bg); color: var(--green); }
  .stat-used  { background: var(--red-bg);   color: var(--red); }

  .header-bottom {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: wrap;
    align-items: center;
  }

  .search {
    font-family: var(--font);
    font-size: 13px;
    padding: 7px 14px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    outline: none;
    flex: 1;
    min-width: 140px;
    max-width: 320px;
    transition: border-color 0.15s;
  }
  .search:focus { border-color: var(--accent); }
  .search::placeholder { color: var(--muted); }

  .filters { display: flex; gap: 6px; flex-wrap: wrap; }

  .filter-btn {
    font-family: var(--font);
    font-size: 12px;
    padding: 6px 13px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .filter-btn:hover { border-color: var(--accent); color: var(--text); }
  .filter-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }

  main { padding: 24px 20px 48px; }

  .app-section { margin-bottom: 40px; }

  .app-name {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
  }

  .app-stats {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
    gap: 14px;
  }

  @media (max-width: 480px) {
    .grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    main { padding: 14px 12px 48px; }
    .header { padding: 10px 14px; }
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
  }
  .card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px #7c6af720;
  }
  .card.given {
    border-color: #3f1515;
    opacity: 0.55;
  }
  .card.given:hover {
    opacity: 1;
    transform: none;
    border-color: var(--red);
    box-shadow: none;
  }

  .card-qr {
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    cursor: pointer;
  }
  .card-qr svg { width: 100%; height: auto; display: block; }

  .card-body {
    padding: 8px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .code-text {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 10px;
    letter-spacing: 0.04em;
    color: var(--text);
    word-break: break-all;
    cursor: pointer;
    user-select: all;
    line-height: 1.4;
    transition: color 0.15s;
  }
  .code-text:hover { color: var(--accent); }
  .code-text.copied { color: var(--green) !important; }

  .badge {
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 10px;
    width: fit-content;
  }
  .badge-avail { background: var(--green-bg); color: var(--green); }
  .badge-used  { background: var(--red-bg);   color: var(--red); }

  .given-to {
    font-size: 11px;
    color: var(--muted);
    font-style: italic;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-actions {
    margin-top: 3px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .assign-row { display: flex; gap: 5px; }

  .assign-input {
    font-family: var(--font);
    font-size: 11px;
    flex: 1;
    padding: 5px 7px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--surface2);
    color: var(--text);
    outline: none;
    min-width: 0;
    transition: border-color 0.15s;
  }
  .assign-input:focus { border-color: var(--accent); }
  .assign-input::placeholder { color: var(--muted); font-style: italic; }

  .btn {
    font-family: var(--font);
    font-size: 11px;
    font-weight: 600;
    padding: 5px 9px;
    border-radius: 7px;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
  }
  .btn:hover { opacity: 0.8; }
  .btn-assign   { background: var(--accent); color: #fff; }
  .btn-unassign { background: var(--surface2); color: var(--muted); border: 1px solid var(--border); }
  .btn-send     { background: var(--accent); color: #fff; width: 100%; text-align: center; }
  .btn-send.copied { background: #166534; }

  .empty {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--muted);
    padding: 60px;
    font-size: 15px;
  }

  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(80px);
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 13px;
    transition: transform 0.25s ease;
    pointer-events: none;
    z-index: 1000;
    white-space: nowrap;
    box-shadow: 0 4px 20px #00000060;
  }
  .toast.show { transform: translateX(-50%) translateY(0); }
</style>
</head>
<body>

<div class="header">
  <div class="header-top">
    <span class="logo">Promo Tracker</span>
    <div class="global-stats">
      <span class="stat stat-total" id="g-total">${totalCodes} total</span>
      <span class="stat stat-avail" id="g-avail">— available</span>
      <span class="stat stat-used"  id="g-used">— given out</span>
    </div>
  </div>
  <div class="header-bottom">
    <input type="search" class="search" id="search" placeholder="Search code or name…">
    <div class="filters">
      <button class="filter-btn active" data-filter="all">All</button>
      <button class="filter-btn" data-filter="available">Available</button>
      <button class="filter-btn" data-filter="given">Given Out</button>
    </div>
  </div>
</div>

<main>${appSectionsHtml}
</main>

<div class="toast" id="toast"></div>

<script>
const APP_DATA = ${JSON.stringify(appData)};
const KEY = 'promo_tracker_v1';

let state = {};

function loadState() {
  try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch(e) { state = {}; }
  // Seed givenTo values from data
  for (const codes of Object.values(APP_DATA)) {
    for (const c of codes) {
      if (c.givenTo && !state[c.code]) state[c.code] = { givenTo: c.givenTo, ts: 0 };
    }
  }
}
function saveState() { localStorage.setItem(KEY, JSON.stringify(state)); }
const isGiven = code => !!state[code];
const givenTo = code => state[code]?.givenTo || '';

let activeFilter = 'all', searchVal = '';

function matches(c) {
  if (activeFilter === 'available' &&  isGiven(c.code)) return false;
  if (activeFilter === 'given'     && !isGiven(c.code)) return false;
  if (searchVal) {
    const q = searchVal.toLowerCase();
    if (!c.code.toLowerCase().includes(q) && !givenTo(c.code).toLowerCase().includes(q)) return false;
  }
  return true;
}

function slugify(app) { return app.replace(/\\s+/g, '-').toLowerCase(); }

function updateStats() {
  let totalGiven = 0;
  for (const [app, codes] of Object.entries(APP_DATA)) {
    const used  = codes.filter(c => isGiven(c.code)).length;
    const avail = codes.length - used;
    const slug  = slugify(app);
    totalGiven += used;
    const el = document.getElementById('stats-' + slug);
    if (el) el.innerHTML =
      \`<span class="stat stat-total">\${codes.length} total</span>
       <span class="stat stat-avail">\${avail} available</span>
       <span class="stat stat-used">\${used} given out</span>\`;
  }
  const total = Object.values(APP_DATA).reduce((s, c) => s + c.length, 0);
  document.getElementById('g-avail').textContent = (total - totalGiven) + ' available';
  document.getElementById('g-used').textContent  = totalGiven + ' given out';
}

function renderCard(c) {
  const given = isGiven(c.code);
  const name  = givenTo(c.code);
  const div = document.createElement('div');
  div.className = 'card' + (given ? ' given' : '');
  div.dataset.code = c.code;
  div.innerHTML =
    \`<div class="card-qr" title="Open redemption link" onclick="window.open('\${c.url}','_blank')">\${c.svg}</div>
     <div class="card-body">
       <div class="code-text" id="ct-\${c.code}" onclick="copyCode('\${c.code}')" title="Click to copy">\${c.code}</div>
       <span class="badge \${given ? 'badge-used' : 'badge-avail'}">\${given ? '✗ Given out' : '✓ Available'}</span>
       \${given && name ? \`<div class="given-to">→ \${name}</div>\` : ''}
       <div class="card-actions">
         \${given
           ? \`<button class="btn btn-unassign" onclick="unassign('\${c.code}')">Mark available</button>\`
           : \`<div class="assign-row">
                <input class="assign-input" id="inp-\${c.code}" placeholder="Name (optional)" onkeydown="if(event.key==='Enter')assign('\${c.code}')">
                <button class="btn btn-assign" onclick="assign('\${c.code}')">Give</button>
              </div>\`
         }
         <button class="btn btn-send" id="cp-\${c.code}" onclick="sendCode('\${c.code}')">↗ Send</button>
       </div>
     </div>\`;
  return div;
}

function renderAll() {
  for (const [app, codes] of Object.entries(APP_DATA)) {
    const slug    = slugify(app);
    const grid    = document.getElementById('grid-' + slug);
    const section = document.getElementById('app-' + slug);
    const visible = codes.filter(matches);
    grid.innerHTML = '';
    section.style.display = visible.length ? '' : 'none';
    if (!visible.length) continue;
    const frag = document.createDocumentFragment();
    visible.forEach(c => frag.appendChild(renderCard(c)));
    grid.appendChild(frag);
  }
  updateStats();
}

function assign(code) {
  const inp  = document.getElementById('inp-' + code);
  const name = inp?.value.trim() || null;
  state[code] = { givenTo: name, ts: Date.now() };
  saveState();
  renderAll();
  toast(name ? 'Given to ' + name : 'Marked as given out');
}

function unassign(code) {
  delete state[code];
  saveState();
  renderAll();
  toast('Marked as available');
}

function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    const el = document.getElementById('ct-' + code);
    if (el) {
      el.classList.add('copied');
      el.textContent = '✓ Copied!';
      setTimeout(() => { el.classList.remove('copied'); el.textContent = code; }, 1500);
    }
  });
}

function sendCode(code) {
  const c = Object.values(APP_DATA).flat().find(x => x.code === code);
  if (!c) return;
  const btn = document.getElementById('cp-' + code);
  const confirmSent = () => {
    if (btn) {
      btn.classList.add('copied');
      btn.textContent = '✓ Sent!';
      setTimeout(() => { btn.classList.remove('copied'); btn.textContent = '\\u2197 Send'; }, 2000);
    }
  };
  if (navigator.share) {
    navigator.share({ title: c.description || 'Promo code', url: c.url }).then(confirmSent).catch(() => {});
  } else {
    navigator.clipboard.writeText(c.url).then(() => { confirmSent(); toast('Link copied'); });
  }
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderAll();
  });
});
document.getElementById('search').addEventListener('input', e => {
  searchVal = e.target.value;
  renderAll();
});

loadState();
renderAll();
</script>
</body>
</html>`;

writeFileSync('./index.html', html, 'utf-8');
console.log(`Built index.html — ${totalCodes} codes across ${totalApps} app(s).`);
