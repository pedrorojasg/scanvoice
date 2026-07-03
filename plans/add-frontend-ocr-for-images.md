# Plan: Image invoice scanning via frontend OCR (Tesseract.js)

> **Deliverable of this task:** save this plan as `plans/tesseract-ocr-image-scanning.md` in the repo. **No code changes now** — implementation happens later, when Pedro green-lights it.

## Context

Scanvoice only accepts text-based PDFs today; images are rejected with a toast, and scanned/image-only PDFs error out. Pedro wants PNG/JPG/WebP invoice scanning under two hard constraints set earlier: **DeepSeek V4 Flash stays the only AI model** (vision models were explicitly rejected and reverted on 2026-07-03), and extraction stays effectively frontend + the existing tiny proxy. The solution: OCR the image **in the browser** with Tesseract.js (WASM) to produce plain text, then feed that text into the *unchanged* existing pipeline (`/api/extract` → DeepSeek). OCR becomes a second "step 1" alongside pdf.js:

```
PDF  → pdf.js text layer   ↘
                             text → /api/extract → DeepSeek V4 Flash (unchanged)
PNG/JPG/WebP → tesseract.js ↗
```

Known trade-offs (accepted, demo-grade): ~3–4MB WASM + ~4–5MB language data on first image scan (lazy, cached); 2–10s OCR time; good accuracy on screenshots/clean scans, weak on skewed phone photos; digit misreads (0/O, 1/l) are possible and DeepSeek cannot recover a wrongly-OCR'd digit.

## What exists and gets reused (do not rebuild)

- `src/lib/pdf.ts` — the lazy-loading pattern to copy: dynamic `import()` + `?url` worker asset, `MIN_TEXT_LENGTH = 40` threshold, typed error class (`PdfTextError`), `formatFileSize`.
- `src/pages/ScanPage.tsx` — phase machine (`idle → reading → extracting → building | error`), `keptText` retry (works for OCR text as-is), `FileChip`, `Stepper` + `STEPS`, drag/drop + file input plumbing.
- `src/lib/extraction.ts` — `requestExtraction(text)` unchanged.
- `api/extract.ts` — unchanged flow/guard; only a one-line prompt addition (below).

## Implementation steps

### 1. Dependency + self-hosted assets
- `npm i tesseract.js` (**v7.0.0**, pairs with `tesseract.js-core` v6.x — confirm exact worker/core asset paths in `node_modules` at implementation time; the v6→v7 API is `createWorker(langs)` returning a ready worker).
- Self-host everything so the app makes **no third-party requests** (consistent with the same-origin guard story):
  - `workerPath` / `corePath` via Vite `?url` imports from `tesseract.js/dist/worker.min.js` and `tesseract.js-core` (wasm).
  - Language data: download `eng.traineddata.gz` + `spa.traineddata.gz` from the `tessdata_fast` repo into `public/tessdata/` (~2MB each), set `langPath: '/tessdata'`. Commit them (Vercel static hosting handles it).

### 2. New module `src/lib/ocr.ts` (mirror pdf.ts's shape)
- `export class OcrTextError extends Error {}`
- `export async function extractImageText(file: File, onProgress?: (pct: number) => void): Promise<{ text: string }>`
  - Lazy `import('tesseract.js')`; module-level cached worker (`createWorker(['eng','spa'], …)`) so a second scan skips init; wire tesseract's `logger` to `onProgress` (use the `recognizing text` status, 0→1).
  - `worker.recognize(file)` → normalize whitespace like pdf.ts does.
  - `< 40` chars of text → throw `OcrTextError('Not enough readable text found in this image — try a sharper, flatter photo or a screenshot.')`.
- `export function isImageFile(file: File): boolean` — MIME `image/png|jpeg|webp` or extension fallback, same dual check style as the PDF check in ScanPage.
- No canvas preprocessing (deskew/binarize) in v1 — note as future work.

### 3. `src/pages/ScanPage.tsx`
- Route by type in `handleFile`: PDF → existing path; `isImageFile` → `reading` phase with OCR (progress % in the step sub-label, e.g. "Recognizing text… 43%"); anything else → updated toast "Only PDF, PNG, JPG or WebP files are supported."
- On OCR success → same `runExtraction(text, base)`; `keptText` retry unchanged.
- UI copy: step 1 title → "Reading document"; dropzone subtitle → "PDF, PNG, JPG or WebP · any layout or language"; footer note → "Images are read with on-device OCR — screenshots and flat scans work best"; drop the "scanned images not supported" line. `FileChip`: `IMG` variant (brand-tint) next to the red `PDF` one; hide page count for images.
- Progress state: add optional `ocrProgress?: number` to `ScanState`; respect `prefers-reduced-motion` as the stepper already does.

### 4. Prompt awareness (2 small text edits, kept in sync)
- `api/extract.ts` `SYSTEM_PROMPT` first paragraph: mention the text may come from OCR of a photographed/scanned invoice, so isolated character misrecognitions are possible — extract what the text supports, never "correct" numbers speculatively.
- Mirror the same sentence in `EXTRACTION_PROMPT.md`.

### 5. Docs + housekeeping
- README: image support section (formats, on-device OCR, ~8MB one-time lazy download, eng+spa), update the feature list and the "text-based PDFs only" caveat.
- `npm run build` check: tesseract must land in its own lazy chunk (like the pdf chunk); main bundle size unchanged.

### 6. Optional extension — decide at implementation: scanned-PDF rescue
When `extractPdfText` finds `< 40` chars, instead of hard-failing: render each page to a canvas (`page.render()` at ~2× scale, cap ~5 pages), OCR the canvases, join with the same `--- Page N ---` markers. Turns today's dead-end error into a working path. Adds ~30 lines to `pdf.ts` + reuses `ocr.ts`. Recommended, but skippable if scope should stay minimal.

## Files touched

| File | Change |
|---|---|
| `plans/tesseract-ocr-image-scanning.md` | **this plan (only file created now)** |
| `package.json` | + `tesseract.js@7` |
| `public/tessdata/{eng,spa}.traineddata.gz` | new, ~4MB total |
| `src/lib/ocr.ts` | new (~70 lines) |
| `src/pages/ScanPage.tsx` | file routing, OCR progress, copy |
| `api/extract.ts` + `EXTRACTION_PROMPT.md` | one-sentence OCR note in prompt |
| `README.md` | image support docs |
| `src/lib/pdf.ts` | only if optional step 6 is included |

## Verification (for the implementation session)

1. `npx tsc -b`, `npm run test` (existing 23 stay green), `npm run build` (tesseract in a lazy chunk).
2. Fixtures via ghostscript: render the existing `invoice.ps` to PNG (`-sDEVICE=png16m -r150`) for a clean scan; a blank/noise PNG for the failure path.
3. Playwright against dev server + mock adapter (reuse the scratchpad harness pattern: `api-server.mjs` mock, drive script): upload PNG → OCR progress visible → draft prefilled → save; blank PNG → clean `OcrTextError` message, no Retry-without-text; `.gif`/`.txt` → toast; **PDF regression**: text-PDF flow and guard passthrough still work.
4. Network check during an image scan: zero third-party requests (all assets same-origin).
5. Live after deploy: real photo + real screenshot of an invoice through DeepSeek; eyeball extracted amounts against the image (digit-misread risk is the thing to spot-check).
