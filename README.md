# Promo Tracker

Static promo code tracker for [promo.airpiehi.com](https://promo.airpiehi.com), deployed via Cloudflare Pages.

## How it works

`generate-promo-tracker.mjs` reads `data/promos.json`, groups codes by app, and writes a dark-themed `index.html`.

Cloudflare Pages runs the build on every push:
- **Build command:** `node generate-promo-tracker.mjs`
- **Output directory:** `.`

## Adding / updating promos

Edit `data/promos.json`. Each entry:

```json
{
  "app": "App Name",
  "code": "PROMO25",
  "description": "Short description of what the code does",
  "url": "https://link-to-app-or-store",
  "expires": "2026-12-31",
  "active": true
}
```

| Field | Required | Notes |
|---|---|---|
| `app` | yes | Groups codes on the page |
| `code` | yes | Displayed in monospace, selectable |
| `description` | yes | Short benefit description |
| `url` | no | Opens in new tab |
| `expires` | no | ISO date string; omit for no expiry |
| `active` | yes | `false` grays out the card |

## Local build

```bash
node generate-promo-tracker.mjs
open index.html
```
