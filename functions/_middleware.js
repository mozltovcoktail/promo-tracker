// ── CHANGE THESE THREE LINES ──────────────────────────────────────────────────
const SESSION_COOKIE   = 'promo_tracker_session'
const PASSWORD_ENV_VAR = 'PROMO_TRACKER_PASSWORD'  // must match Cloudflare Pages secret name
const SESSION_MAX_AGE  = 60 * 60 * 24 * 30  // 30 days — adjust if needed
// ─────────────────────────────────────────────────────────────────────────────

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url)

  if (url.pathname === '/login' || url.pathname === '/login.html') return next()

  const password = env[PASSWORD_ENV_VAR]
  if (!password) return next() // no secret configured → open (local dev)

  // ?token=PASSWORD — set cookie and serve the page (mobile shortcut / share link)
  const tokenParam = url.searchParams.get('token')
  if (tokenParam === password) {
    const sessionToken = await signToken(password)
    const response = await next()
    const newResp = new Response(response.body, response)
    newResp.headers.append(
      'Set-Cookie',
      `${SESSION_COOKIE}=${sessionToken}; Max-Age=${SESSION_MAX_AGE}; Path=/; HttpOnly; SameSite=Lax; Secure`
    )
    return newResp
  }

  const cookie = parseCookie(request.headers.get('cookie') || '')
  if (cookie[SESSION_COOKIE] && await verifyToken(cookie[SESSION_COOKIE], password)) {
    return next()
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', url.pathname)
  return Response.redirect(loginUrl.toString(), 302)
}

// ── HMAC token helpers — no changes needed below ─────────────────────────────

export async function signToken(password) {
  const key = await importKey(password)
  const ts = Date.now().toString()
  const sig = await crypto.subtle.sign('HMAC', key, enc(ts))
  return `${ts}.${bufToHex(sig)}`
}

async function verifyToken(token, password) {
  try {
    const [ts, sig] = token.split('.')
    if (!ts || !sig) return false
    if (Date.now() - parseInt(ts, 10) > SESSION_MAX_AGE * 1000) return false
    const key = await importKey(password)
    const expected = await crypto.subtle.sign('HMAC', key, enc(ts))
    const a = hexToBuf(sig)
    const b = new Uint8Array(expected)
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  } catch {
    return false
  }
}

async function importKey(password) {
  return crypto.subtle.importKey(
    'raw', enc(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify']
  )
}

export { SESSION_COOKIE, SESSION_MAX_AGE, verifyToken }

function parseCookie(str) {
  return Object.fromEntries(
    str.split(';').map(p => p.trim().split('=')).filter(p => p.length === 2).map(([k, v]) => [k.trim(), v.trim()])
  )
}

const enc = s => new TextEncoder().encode(s)
const bufToHex = b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('')
const hexToBuf = h => new Uint8Array(h.match(/.{2}/g).map(b => parseInt(b, 16)))
