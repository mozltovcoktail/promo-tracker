// Unit tests for the Cloudflare Pages password gate (functions/_middleware.js):
// HMAC token round-trips, expiry, tampering, and the request-gating behaviour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest, signToken, verifyToken, SESSION_MAX_AGE } from '../functions/_middleware.js';

const PW = 'passywassy';
const env = { PROMO_TRACKER_PASSWORD: PW };
const next = async () => new Response('APP', { status: 200 });

// ── token sign / verify ──
test('a freshly signed token verifies against the same password', async () => {
  assert.equal(await verifyToken(await signToken(PW), PW), true);
});

test('a token signed with one password does not verify under another', async () => {
  assert.equal(await verifyToken(await signToken(PW), 'not-the-password'), false);
});

test('a tampered signature fails verification', async () => {
  const [ts, sig] = (await signToken(PW)).split('.');
  const flipped = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0');
  assert.equal(await verifyToken(`${ts}.${flipped}`, PW), false);
});

test('malformed tokens fail safely', async () => {
  for (const bad of ['', 'garbage', 'a.b', '.', 'no-dot']) {
    assert.equal(await verifyToken(bad, PW), false);
  }
});

test('an expired token (timestamp older than max-age) is rejected', async () => {
  const enc = s => new TextEncoder().encode(s);
  const key = await crypto.subtle.importKey('raw', enc(PW), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const oldTs = String(Date.now() - (SESSION_MAX_AGE * 1000 + 60_000));
  const sig = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, enc(oldTs)))]
    .map(x => x.toString(16).padStart(2, '0')).join('');
  assert.equal(await verifyToken(`${oldTs}.${sig}`, PW), false);
});

// ── request gating ──
test('unauthenticated requests are redirected to /login', async () => {
  const res = await onRequest({ request: new Request('https://promo.test/'), env, next });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /\/login/);
});

test('the /login route is always allowed through', async () => {
  const res = await onRequest({ request: new Request('https://promo.test/login'), env, next });
  assert.equal(await res.text(), 'APP');
});

test('a valid session cookie is let through to the app', async () => {
  const token = await signToken(PW);
  const res = await onRequest({
    request: new Request('https://promo.test/', { headers: { cookie: `promo_tracker_session=${token}` } }),
    env, next,
  });
  assert.equal(await res.text(), 'APP');
});

test('the gate is bypassed when the password env var is unset (local dev)', async () => {
  const res = await onRequest({ request: new Request('https://promo.test/'), env: {}, next });
  assert.equal(await res.text(), 'APP');
});

test('?token=PASSWORD authenticates and sets the session cookie', async () => {
  const res = await onRequest({ request: new Request(`https://promo.test/?token=${PW}`), env, next });
  assert.equal(await res.text(), 'APP');
  assert.match(res.headers.get('set-cookie') || '', /promo_tracker_session=/);
});
