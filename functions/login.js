// ── CHANGE THESE FOUR LINES ───────────────────────────────────────────────────
const APP_NAME       = 'Promo Tracker'
const APP_TAGLINE    = 'Colorbolt promo codes'
const PASSWORD_ENV_VAR = 'PROMO_TRACKER_PASSWORD'  // must match _middleware.js
const ACCENT         = '#7c6af7'             // CSS hex color for button + logo gradient
// ─────────────────────────────────────────────────────────────────────────────

import { signToken, SESSION_COOKIE, SESSION_MAX_AGE } from './_middleware.js'

export async function onRequestGet({ request }) {
  const next = new URL(request.url).searchParams.get('next') || '/'
  return html(next, null)
}

export async function onRequestPost({ request, env }) {
  const next = new URL(request.url).searchParams.get('next') || '/'
  const form = await request.formData()
  const password = form.get('password') || ''

  if (!env[PASSWORD_ENV_VAR] || password !== env[PASSWORD_ENV_VAR]) {
    return html(next, 'Wrong password', 401)
  }

  const token = await signToken(env[PASSWORD_ENV_VAR])
  return new Response(null, {
    status: 302,
    headers: {
      'Location': next,
      'Set-Cookie': [
        `${SESSION_COOKIE}=${token}`,
        `Max-Age=${SESSION_MAX_AGE}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Secure',
      ].join('; '),
    },
  })
}

function html(next, error, status = 200) {
  const accentGlow = ACCENT + '2e' // 18% opacity hex suffix
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${APP_NAME}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
  :root {
    --bg: #0a0a0f;
    --surface: #13131a;
    --border: #1e1e2a;
    --accent: ${ACCENT};
    --text: #e2e0f0;
    --text-2: #8b89a6;
    --error: #f76a6a;
    --r: 10px;
  }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    width: 360px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 40px 36px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .logo {
    text-align: center;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .tagline {
    text-align: center;
    font-size: 13px;
    color: var(--text-2);
    margin-top: 4px;
  }
  form { display: flex; flex-direction: column; gap: 12px }
  input[type="password"] {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--r);
    color: var(--text);
    font-size: 15px;
    padding: 12px 14px;
    outline: none;
    transition: border-color .15s, box-shadow .15s;
    width: 100%;
  }
  input[type="password"]:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px ${accentGlow};
  }
  input[type="password"]::placeholder { color: var(--text-2) }
  button {
    background: var(--accent);
    border: none;
    border-radius: var(--r);
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: .02em;
    padding: 12px;
    transition: filter .15s, transform .1s;
  }
  button:hover { filter: brightness(1.15) }
  button:active { transform: scale(.98) }
  .error {
    background: rgba(247,106,106,.1);
    border: 1px solid rgba(247,106,106,.3);
    border-radius: 8px;
    color: var(--error);
    font-size: 13px;
    padding: 10px 12px;
    text-align: center;
  }
</style>
</head>
<body>
<div class="card">
  <div>
    <div class="logo">${APP_NAME}</div>
    <div class="tagline">${APP_TAGLINE}</div>
  </div>
  ${error ? `<div class="error">${error}</div>` : ''}
  <form method="POST" action="/login?next=${encodeURIComponent(next)}">
    <input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password">
    <button type="submit">Enter →</button>
  </form>
</div>
</body>
</html>`, { status, headers: { 'Content-Type': 'text/html;charset=utf-8' } })
}
