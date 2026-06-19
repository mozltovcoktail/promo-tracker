import { readFileSync, writeFileSync } from 'fs';

const promos = JSON.parse(readFileSync('./data/promos.json', 'utf-8'));

// Group by app
const byApp = {};
for (const promo of promos) {
  if (!byApp[promo.app]) byApp[promo.app] = [];
  byApp[promo.app].push(promo);
}

const now = new Date();

function isExpired(expires) {
  if (!expires) return false;
  return new Date(expires) < now;
}

function formatExpiry(expires) {
  if (!expires) return 'No expiry';
  const d = new Date(expires);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysLeft(expires) {
  if (!expires) return null;
  const diff = new Date(expires) - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function renderPromo(promo) {
  const expired = isExpired(promo.expires);
  const inactive = !promo.active;
  const dead = expired || inactive;
  const days = daysLeft(promo.expires);

  let badgeHtml = '';
  if (inactive) {
    badgeHtml = '<span class="badge badge-inactive">Inactive</span>';
  } else if (expired) {
    badgeHtml = '<span class="badge badge-expired">Expired</span>';
  } else if (days !== null && days <= 7) {
    badgeHtml = `<span class="badge badge-expiring">Expires in ${days}d</span>`;
  } else {
    badgeHtml = '<span class="badge badge-active">Active</span>';
  }

  const linkHtml = promo.url
    ? `<a class="promo-link" href="${promo.url}" target="_blank" rel="noopener">Open ↗</a>`
    : '';

  return `
    <div class="promo-card${dead ? ' promo-dead' : ''}">
      <div class="promo-header">
        <code class="promo-code">${promo.code}</code>
        ${badgeHtml}
      </div>
      <p class="promo-desc">${promo.description}</p>
      <div class="promo-footer">
        <span class="promo-expiry">${formatExpiry(promo.expires)}</span>
        ${linkHtml}
      </div>
    </div>`;
}

function renderApp([app, promos]) {
  const cards = promos.map(renderPromo).join('');
  return `
  <section class="app-section">
    <h2 class="app-name">${app}</h2>
    <div class="promo-grid">${cards}
    </div>
  </section>`;
}

const sectionsHtml = Object.entries(byApp).map(renderApp).join('');

const totalActive = promos.filter(p => p.active && !isExpired(p.expires)).length;
const totalAll = promos.length;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Promo Tracker</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0d0d0f;
      --surface: #16161a;
      --surface-2: #1e1e24;
      --border: #2a2a33;
      --text: #e8e8f0;
      --text-muted: #7a7a8a;
      --accent: #7c6af7;
      --accent-dim: #4a3faa;
      --green: #3ecf8e;
      --red: #f86868;
      --yellow: #f0a832;
      --dead: #3a3a44;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      padding: 2rem 1rem 4rem;
    }

    header {
      max-width: 900px;
      margin: 0 auto 2.5rem;
      display: flex;
      align-items: baseline;
      gap: 1.25rem;
      flex-wrap: wrap;
    }

    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #a89cff 0%, #6af7c8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .meta {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-left: auto;
    }

    main {
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 2.5rem;
    }

    .app-section {}

    .app-name {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 0.875rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
    }

    .promo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 0.75rem;
    }

    .promo-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem 1.125rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      transition: border-color 0.15s;
    }

    .promo-card:hover {
      border-color: var(--accent-dim);
    }

    .promo-dead {
      opacity: 0.45;
    }

    .promo-header {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      flex-wrap: wrap;
    }

    .promo-code {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--accent);
      background: rgba(124, 106, 247, 0.1);
      padding: 0.2em 0.5em;
      border-radius: 5px;
      letter-spacing: 0.04em;
      user-select: all;
    }

    .badge {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 0.2em 0.55em;
      border-radius: 4px;
    }

    .badge-active   { background: rgba(62,207,142,0.15); color: var(--green); }
    .badge-expiring { background: rgba(240,168,50,0.15);  color: var(--yellow); }
    .badge-expired  { background: rgba(248,104,104,0.12); color: var(--red); }
    .badge-inactive { background: rgba(122,122,138,0.15); color: var(--text-muted); }

    .promo-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.45;
      flex: 1;
    }

    .promo-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 0.25rem;
    }

    .promo-expiry {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .promo-link {
      font-size: 0.75rem;
      color: var(--accent);
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.12s;
    }

    .promo-link:hover { opacity: 0.75; }

    footer {
      max-width: 900px;
      margin: 3rem auto 0;
      font-size: 0.75rem;
      color: var(--text-muted);
      text-align: center;
    }

    @media (max-width: 500px) {
      .promo-grid { grid-template-columns: 1fr; }
      h1 { font-size: 1.4rem; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Promo Tracker</h1>
    <span class="meta">${totalActive} active &nbsp;/&nbsp; ${totalAll} total</span>
  </header>
  <main>${sectionsHtml}
  </main>
  <footer>Generated ${now.toUTCString()}</footer>
</body>
</html>`;

writeFileSync('./index.html', html, 'utf-8');
console.log(`Built index.html — ${totalActive} active promo(s) across ${Object.keys(byApp).length} app(s).`);
