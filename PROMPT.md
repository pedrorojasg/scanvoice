# Build an AI Invoice Scraper — Demo Web App

## What you are building

A polished, demo-quality web application that lets a user upload a PDF invoice in any format, extracts its data using an LLM (DeepSeek V4 Flash via OpenRouter), shows the result as an editable digital draft invoice, and manages a local list of invoices and products with dashboards, search, and pagination.

Build the complete app end to end. Do not leave TODOs or stub features.

## Tech stack (mandatory)

- **Frontend:** Vite + React + TypeScript (SPA).
- **UI:** Tailwind CSS + shadcn/ui, implementing the approved visual design specified in the "UI design (approved)" section below. Toasts, skeleton loaders, and empty states throughout.
- **PDF parsing:** `pdfjs-dist` (pdf.js) running fully in the browser to extract the text content of the uploaded PDF. No server-side PDF processing.
- **AI:** OpenRouter chat completions API, model `deepseek/deepseek-v4-flash`.
- **API key security:** the OpenRouter key must NEVER be exposed to the browser. Create exactly one tiny serverless function (Vercel-style, e.g. `api/extract.ts`) that:
  - Receives `{ text: string }` (the extracted PDF text) via POST.
  - Reads `OPENROUTER_API_KEY` from server environment variables.
  - Calls OpenRouter and returns the parsed JSON result to the client.
  - Everything else in the app is pure frontend.
  - For local development, make it work with `vercel dev` (or provide an equivalent local proxy) and document it in the README.
- **Persistence:** browser `localStorage` only. No database. Wrap all storage access in a small typed repository module (e.g. `lib/storage.ts`) so it could later be swapped for an API.
- **Routing:** react-router (or equivalent) with at least these pages: Dashboard/Invoices, Invoice detail/edit, Upload/Scan, Products.

## Data model (mandatory — mirror exactly, in TypeScript)

```ts
type InvoiceStatus =
  | "draft"
  | "open"
  | "partially paid"
  | "paid"
  | "canceled";

// The status <select> in the UI offers only these five options:
// draft, open, partially paid, paid, canceled

interface InvoiceLineItem {
  id: string;                 // uuid, client-generated
  product_name: string;
  product_barcode: string | null;
  unit_price: string | null;      // decimal as string
  quantity: string | null;        // decimal as string
  total_discounts: string | null; // decimal as string
  total_tax: string | null;       // decimal as string
  total_amount: string | null;    // decimal as string
  total_amount_paid: string | null; // decimal as string
}

interface Invoice {
  id: string;                  // uuid, client-generated
  status: InvoiceStatus;       // default "draft"
  number: string | null;       // invoice number as printed on the document
  note: string | null;
  opened_date: string | null;  // ISO 8601 datetime
  due_date: string | null;     // ISO 8601 datetime
  customer_name: string | null;
  customer_address: string | null;
  total_amount: string | null;   // decimal as string — total incl. taxes, discounts, fees, shipping
  amount_paid: string | null;    // decimal as string — payments received
  net_terms_other_notes: string | null;
  line_items: InvoiceLineItem[];
  created_at: string;          // ISO 8601, set on save
  updated_at: string;          // ISO 8601, set on every save
}

interface Product {
  name: string;             // unique key
  barcode: string | null;
  last_unit_price: string | null; // decimal as string
}
```

**Decimal handling:** all money/quantity values are stored as strings to preserve precision (the source model uses `Decimal(max_digits=20, decimal_places=5)`). Never store them as JS floats. Use a small decimal library (`big.js` or `decimal.js`) for any arithmetic (summaries, totals). Display money formatted to 2 decimals with thousands separators.

**Products are derived, read-only data.** Products are never edited by the user. Rules:
- When an invoice is saved, upsert one Product per line item, keyed by unique `product_name`.
- `last_unit_price` must always be the `unit_price` from the **most recently imported/saved** invoice containing that product.
- `barcode` updates when the latest line item provides one.
- The Products UI is a read-only list: no create, edit, or delete controls.

## Feature requirements

### 1. Upload & AI extraction flow ("Scan invoice" page)

- Drag-and-drop zone plus file picker, accepting `.pdf` only. Show file name and size after selection.
- On upload:
  1. Extract all text from the PDF with pdf.js (all pages, concatenated with page markers).
  2. If the PDF yields no/negligible text (scanned image PDF), show a clear error: text-based PDFs only.
  3. POST the text to the serverless `api/extract` endpoint.
  4. Show an engaging multi-step progress indicator while waiting (e.g. "Reading PDF → Extracting with AI → Building draft…").
- The serverless function sends the text to DeepSeek V4 Flash with:
  - A system prompt instructing it to act as an invoice-data-extraction engine and return **only valid JSON**, no markdown fences, matching the exact schema of the Invoice + line items above (excluding `id`, `created_at`, `updated_at`, `status`).
  - Instructions for the model: dates as ISO 8601; decimals as strings; `null` for anything not present in the document; extract every line item with name, barcode (if printed), unit price, quantity, discounts, tax, total; `total_amount` is the grand total including taxes/discounts/fees/shipping.
  - `temperature: 0` and OpenRouter's JSON output mode (`response_format: { type: "json_object" }`) if available.
- Client-side, validate the AI response with `zod` before using it. If the JSON is invalid or the request fails, show an error toast with a **Retry** button (re-uses the already-extracted text; no re-upload needed).

### 2. Draft invoice editor

- After successful extraction, navigate to a draft invoice view pre-filled with the extracted data. The invoice is not yet persisted — it becomes stored only when the user clicks **Save**.
- Editable form for every invoice field: status (select with the five allowed choices), number, customer name, customer address, due date and opened date (date-time pickers), total amount, amount paid, note, net terms/other notes.
- Editable line-items table: edit any cell, add a row, delete a row. Show a computed line-items sum and highlight (non-blocking warning) if it differs from `total_amount`.
- Styled to resemble a real invoice document (header with number/status badge, customer block, items table, totals block).
- **Save** persists to localStorage (status defaults to `draft`), runs the product upsert rules, shows a success toast, and navigates to the invoice list.
- The same editor is used to open and edit any previously saved invoice (edit + delete with a confirmation dialog).

### 3. Invoice list + status summary dashboard

- **Summary grid at the top:** one highlight card per status (Draft, Open, Partially Paid, Paid, Canceled) showing the **sum of `total_amount`** and the invoice count for that status, computed with decimal-safe arithmetic. Give each status a distinct accent color, reused consistently everywhere (badges, cards).
- **Table below:** number, customer name, status (colored badge), due date, total amount, amount paid; row click opens the invoice editor.
- **Frontend search:** single text input filtering by invoice number, customer name, and status (case-insensitive, as-you-type).
- **Pagination:** client-side, 20 per page, with page controls and "showing X–Y of Z". Search and pagination compose correctly (search resets to page 1).
- Sensible default sort: newest first.

### 4. Products list

- Read-only table: product name, barcode, last unit price.
- Same frontend search (by name and barcode) and same client-side pagination pattern as invoices.
- Empty state explaining that products appear automatically when invoices are imported.

## UI design (approved — implement this, do not invent a different look)

The visual direction was mocked up and approved. Concept: **paper & ink** — invoices are documents, so the app sits on a warm paper ground with near-black ink. Almost all color is *semantic* (the five status colors); one deep ledger-green accent is reserved for primary actions. All data figures use monospace, giving an accounting-ledger character.

### Design tokens (map into Tailwind theme / CSS variables)

```
--paper:   #F7F7F4   page background (warm paper)
--surface: #FFFFFF   cards, tables, sidebar
--ink:     #16211C   primary text (green-biased near-black)
--ink-2:   #5A6660   secondary text
--ink-3:   #8B948F   muted text, placeholders, labels
--line:    #E3E5E0   hairline borders
--accent:  #175E45   primary buttons, active nav, focus rings (hover: #0F4634; tint bg: #E8F1ED)

Status colors (text on ~10% tint background, used identically in pills and summary-card dots):
draft      #5A6660 on #EEF0EE
open       #1D4ED8 on #E8EDFB
part. paid #A16207 on #F7EFDC
paid       #15803D on #E4F2E9
canceled   #B42318 on #F9E9E7
```

### Typography

- UI text: system sans stack (`-apple-system, "Segoe UI", Roboto, …`).
- **All data figures — money, quantities, invoice numbers, barcodes, dates in tables — use the monospace stack** (`ui-monospace, "SF Mono", Menlo, …`) with `font-variant-numeric: tabular-nums`. Money is always right-aligned.
- Labels above form fields and table headers: 11px, uppercase, letter-spaced, muted color, semibold.

### Layout & components

- **App shell:** fixed ~228px white sidebar (brand mark = accent-green rounded square, app name + "AI invoice scraper" subtitle; nav items with small line icons; active item = accent tint background + accent text). Content area max-width ~1180px, on paper background.
- **Status pills:** rounded-full, tint background, colored dot + label. Used in tables and everywhere a status appears — never color alone, always with the text label.
- **Summary grid (Invoices):** 5 white cards in a row (2-col on mobile): uppercase label with status dot, large monospace sum, "N invoices" muted below. Cards stay neutral white — the status color appears only in the dot.
- **Tables:** inside white cards with a top toolbar (search input on paper-tinted background + "Showing X–Y of Z" right-aligned); hairline row borders; hover tint on clickable rows; pagination footer with square page buttons (active = ink background, white text).
- **Scan page:** dashed-border dropzone with accent-tinted icon (hover: accent border + tint bg); processing card shows file chip (red "PDF" icon, name, size/pages) and a 3-step vertical stepper — done steps: filled accent circles with ✓ and accent connector line; current step: outlined accent circle, subtly pulsing (respect `prefers-reduced-motion`); pending: gray. Extraction failure: red-tinted alert with bold title, explanation ("Your PDF text is kept — retry without re-uploading"), and a Retry button.
- **Invoice editor:** two columns — the invoice document (left, white card with slight shadow: header row = "INVOICE NUMBER" kicker + big monospace number + status select; 2-col field grid; line-items table with inputs in cells and per-row delete; right-aligned totals block: line-items sum, amount paid, grand total emphasized above a hairline) and a right action panel (~280px card: "Save this draft" title, explanation that saving updates the product catalog, full-width accent Save button, ghost Discard, red-text Delete, plus a small meta list: products detected, model name). Total mismatch = amber-tinted inline warning below totals, non-blocking, wording like: "Line items add up to $X but the invoice total is $Y. The document may include shipping or fees — you can still save."
- Buttons: primary = accent background/white text; secondary = white with hairline border; destructive = red text, red-tint hover. Radii: ~8px controls, ~10–12px cards. Shadows minimal (hairline borders do the separation).
- Focus states: 2px accent outline, offset, on every interactive element.
- Dark mode: optional; if implemented, derive it from these tokens (dark surfaces, same status hues re-tuned for contrast) — do not ship an unreviewed auto-inverted theme.

## Deployment (single Vercel project)

The whole app deploys as **one Vercel project** — there are not two separate deployments:

- The Vite SPA is built to static assets and served from Vercel's CDN.
- The `api/extract.ts` file lives in an `api/` directory at the repository root. Vercel automatically turns each file in `api/` into a serverless function in the same deployment — no separate project, config, or repo.
- Because frontend and function share the same domain, the client calls a relative `/api/extract` URL: no CORS setup, no environment-specific API base URL.

Requirements:

- Structure the repo so this works out of the box: Vite app at the root, `api/` folder alongside it. Add a `vercel.ts` (or `vercel.json`) only if needed for the SPA fallback rewrite (all non-`/api` routes → `index.html`) so react-router deep links work.
- `OPENROUTER_API_KEY` is set once in the Vercel project's environment variables (Production + Preview + Development); the README must document this and `vercel env pull` for local dev.
- Local development runs with `vercel dev` (serves the SPA and the function together), or document an equivalent Vite proxy setup.
- Deploys: `vercel` for a preview URL, `vercel --prod` for production. Every git push (if the repo is connected to Vercel) creates a preview deployment automatically.

## Quality bar

- Fully typed TypeScript, no `any` in application code.
- Loading, error, and empty states for every async or data-driven view.
- Responsive layout (usable at mobile widths; tables may scroll horizontally).
- A seed mechanism (button or auto-seed on first run) that loads a few demo invoices/products so the dashboard looks alive without an API key.
- README covering: setup, `OPENROUTER_API_KEY` env var, local dev with the serverless function, and deployment to Vercel.
- No hardcoded API keys anywhere in the repo.

## Suggested build order

1. Scaffold Vite + React + TS + Tailwind + shadcn/ui, layout shell with sidebar navigation.
2. Types, zod schemas, localStorage repository (invoices CRUD + product derivation), seed data.
3. Invoice list with summary grid, search, pagination; products list.
4. Invoice editor (create/edit/delete) with line-items table.
5. PDF upload + pdf.js text extraction.
6. Serverless OpenRouter proxy + extraction prompt + validation + retry flow.
7. Polish: toasts, skeletons, empty states, dark mode, responsive checks.
