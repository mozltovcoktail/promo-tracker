const KV_KEY = 'assignments'

export async function onRequestGet({ env }) {
  if (!env.PROMO_STATE) return Response.json({ state: {} })
  const raw = await env.PROMO_STATE.get(KV_KEY)
  return Response.json({ state: raw ? JSON.parse(raw) : {} })
}

export async function onRequestPost({ request, env }) {
  if (!env.PROMO_STATE) return Response.json({ ok: false, error: 'KV not bound' }, { status: 503 })
  const { state } = await request.json()
  await env.PROMO_STATE.put(KV_KEY, JSON.stringify(state ?? {}))
  return Response.json({ ok: true })
}
