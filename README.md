# Scanvoice — AI invoice scraper (demo)

Upload a PDF invoice in any format or language, let DeepSeek V4 Flash (via OpenRouter) extract it into a structured draft invoice, review and edit it, then manage your invoices and auto-derived product catalog — all stored locally in the browser.

**Stack:** Vite + React + TypeScript · Tailwind CSS v4 + shadcn/ui · pdf.js (client-side text extraction) · one Vercel serverless function (`api/extract.ts`) proxying OpenRouter · localStorage persistence.

## Features

- **Scan invoice** — drag-and-drop a text-based PDF; text is extracted in the browser with pdf.js and sent to `api/extract`, which asks DeepSeek V4 Flash for structured JSON (validated with zod). Failures keep the extracted text so you can retry without re-uploading.
- **Draft editor** — invoice-document-styled form: every field editable, line-items table with add/delete rows, decimal-safe totals check with a non-blocking mismatch warning.
- **Invoices dashboard** — per-status summary cards (sum + count), search, client-side pagination.
- **Products** — read-only catalog derived from saved invoices' line items; `last_unit_price` always reflects the most recently saved invoice.
- Demo data auto-seeds on first run so the app looks alive without an API key.

## Setup

```bash
npm install
```

### Environment variable

The only secret is the OpenRouter API key, read **server-side** by `api/extract.ts`:

| Variable | Where |
|---|---|
| `OPENROUTER_API_KEY` | Vercel project → Settings → Environment Variables (Production, Preview, Development). For local dev: `.env.local` (see `.env.example`) or `vercel env pull`. |

Get a key at [openrouter.ai/keys](https://openrouter.ai/keys). The key is never bundled into the frontend.

### API abuse guard

`/api/extract` spends real OpenRouter credit, so it ships with a lightweight guard:

- **Same-origin check** — the request's `Origin`/`Referer` must match the host serving the function; direct curl/scripts get a 403. (A deterrent, not authentication — origins can be spoofed.)
- **Per-IP rate limit** — 10 scans per 10 minutes, in-memory (persists across requests on Fluid Compute instances, resets on cold start).
- **Cost bounds** — input truncated to 60k chars, `max_tokens` capped.

## Local development

The app is a Vite SPA plus one Vercel function. Two options:

**Option A — `vercel dev` (recommended, runs both):**

```bash
npm i -g vercel
vercel dev
```

**Option B — Vite + function side by side:**

```bash
# terminal 1: serves api/extract.ts on :3000
vercel dev --listen 3000
# terminal 2: Vite dev server; /api/* is proxied to :3000 (see vite.config.ts)
npm run dev
```

Without a key (or without the function running), everything except the AI call still works — including the scan flow's error/retry path and all list/editor features on seeded data.

## Scripts

```bash
npm run dev        # Vite dev server
npm run build      # typecheck + production build
npm run test       # vitest (decimal + storage/product-derivation units)
npm run typecheck  # tsc -b
```

## Deployment (single Vercel project)

Frontend and serverless function deploy together — Vercel builds the Vite SPA to static assets and turns `api/extract.ts` into a serverless function on the same domain (so the client calls a relative `/api/extract`; no CORS).

```bash
vercel        # preview deployment
vercel --prod # production
```

Set `OPENROUTER_API_KEY` in the project's environment variables before the first scan. `vercel.json` contains the SPA fallback rewrite so react-router deep links work.

## Data model notes

- All money/quantity values are **decimal strings** (source model: `Decimal(30,10)`); arithmetic uses [big.js](https://github.com/MikeMcl/big.js) — never floats.
- Products are derived, read-only data: saving an invoice upserts one product per line item, keyed by unique name.
- localStorage keys: `scanvoice.invoices`, `scanvoice.products`, `scanvoice.seeded`.
- The runtime extraction prompt lives in `api/extract.ts` (documented in `EXTRACTION_PROMPT.md`); the full build spec is `PROMPT.md`.
