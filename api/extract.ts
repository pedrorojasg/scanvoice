import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * The only server-side code in the app: proxies extraction requests to
 * OpenRouter so the API key never reaches the browser.
 */

const MODEL = 'deepseek/deepseek-v4-flash'
const MAX_TEXT_LENGTH = 60_000
const MAX_COMPLETION_TOKENS = 16_000 // bounds worst-case cost per request

// ---- Abuse guard -----------------------------------------------------------
// This is a public demo endpoint spending real OpenRouter credit. Two layers:
// 1. Same-origin check: the request's Origin/Referer must match the host the
//    function is served from. Deters direct curl/scripts (spoofable, not auth).
// 2. Per-IP rate limit, in-memory. Fluid Compute reuses instances, so this
//    holds across requests; it resets on cold start, which is fine for a demo.
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const hitsByIp = new Map<string, number[]>()

function isSameOrigin(req: VercelRequest): boolean {
  const source = req.headers.origin ?? req.headers.referer
  if (!source) return false
  const forwardedHost = req.headers['x-forwarded-host']
  const hosts = [
    Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost,
    req.headers.host,
  ].filter(Boolean)
  try {
    const sourceHost = new URL(source).host
    return hosts.includes(sourceHost)
  } catch {
    return false
  }
}

function isRateLimited(req: VercelRequest): boolean {
  const forwarded = req.headers['x-forwarded-for']
  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  const now = Date.now()
  const recent = (hitsByIp.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    hitsByIp.set(ip, recent)
    return true
  }
  recent.push(now)
  hitsByIp.set(ip, recent)
  return false
}

// Runtime extraction prompt — kept in sync with EXTRACTION_PROMPT.md.
const SYSTEM_PROMPT = `You are an invoice data extraction engine. You receive the raw text of an invoice
extracted from a PDF (any language, any layout, possibly messy: broken lines,
repeated headers, page markers). Your only job is to extract structured data
from it.

OUTPUT RULES — follow all of them strictly:
1. Respond with a single valid JSON object and NOTHING else. No markdown fences,
   no comments, no explanations, no trailing commas.
2. The JSON must match EXACTLY this schema (every key present, no extra keys):

{
  "number": string | null,
  "note": string | null,
  "opened_date": string | null,
  "due_date": string | null,
  "customer_name": string | null,
  "customer_address": string | null,
  "total_amount": string | null,
  "amount_paid": string | null,
  "net_terms_other_notes": string | null,
  "line_items": [
    {
      "product_name": string,
      "product_barcode": string | null,
      "unit_price": string | null,
      "quantity": string | null,
      "total_discounts": string | null,
      "total_tax": string | null,
      "total_amount": string | null,
      "total_amount_paid": string | null
    }
  ]
}

FIELD SEMANTICS:
- "number": the invoice number/identifier as printed on the document
  (e.g. "INV-2024-0042", "F-000123"). Not the order number, not the customer
  number — but if only one identifier exists, use it.
- "note": any free-text note or message addressed to the customer printed on
  the invoice.
- "opened_date": the invoice issue/emission date.
- "due_date": the payment due date. If only payment terms are given
  (e.g. "Net 30"), compute due_date = opened_date + term days when
  opened_date is known; otherwise leave null and put the terms in
  "net_terms_other_notes".
- "customer_name": the party being billed (bill-to), not the seller/issuer.
- "customer_address": the bill-to address as a single string, lines joined
  with ", ".
- "total_amount": the final grand total of the invoice, INCLUDING all taxes,
  discounts, fees and shipping. If several totals appear, choose the final
  amount due before any payments.
- "amount_paid": payments already received/applied, if stated (deposits,
  partial payments). Null if not mentioned.
- "net_terms_other_notes": payment terms (e.g. "Net 30", "2/10 Net 30"),
  bank/IBAN details, late fee clauses, and any other conditions text.
- "line_items": one entry per product/service line in the items table.
  - "product_name": the item description, cleaned of line-break artifacts.
  - "product_barcode": barcode/EAN/UPC/SKU code printed for the item, else null.
  - "unit_price": price per single unit, before line discounts.
  - "quantity": quantity as printed (may be fractional).
  - "total_discounts": total discount amount applied to this line (as a
    positive number), null if none shown. If only a percentage is shown,
    compute the amount when possible.
  - "total_tax": total tax amount for this line, null if not shown per line.
  - "total_amount": the line total as printed.
  - "total_amount_paid": amount paid attributable to this line, almost always
    null unless explicitly printed.
  - Exclude summary rows (subtotal, tax, shipping, total) from line_items;
    they belong to the invoice-level fields.

FORMATTING RULES:
- Dates: ISO 8601 ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss"). Interpret ambiguous
  formats using the document's locale/language as a hint; if a date is truly
  ambiguous or unreadable, use null.
- All monetary and quantity values: JSON strings containing plain decimal
  numbers with "." as decimal separator and no thousands separators, no
  currency symbols (e.g. "1234.50"). Convert "1.234,50 €" to "1234.50".
- Use null for any field not present in the document. NEVER invent, guess or
  estimate values that are not supported by the text.
- Trim whitespace; collapse internal line breaks in text fields to single
  spaces (except "customer_address", which uses ", " between address lines).
- If the text is not an invoice at all (or is unreadable), return the schema
  with every field null and "line_items": [].`

function parseModelJson(content: string): unknown {
  try {
    return JSON.parse(content)
  } catch {
    // One repair attempt: models occasionally wrap JSON in fences or prose.
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(content.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' })
    return
  }

  if (!isSameOrigin(req)) {
    res.status(403).json({ error: 'Requests are only accepted from the Scanvoice app.' })
    return
  }
  if (isRateLimited(req)) {
    res.status(429).json({
      error: 'Too many scans from this address — try again in a few minutes.',
    })
    return
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
  if (!text) {
    res.status(400).json({ error: 'Missing "text" in request body.' })
    return
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    res.status(500).json({
      error: 'The server is missing the OPENROUTER_API_KEY environment variable.',
    })
    return
  }

  let upstream: Response
  try {
    upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Extract the invoice data from the following document text.\n\n<document>\n${text.slice(0, MAX_TEXT_LENGTH)}\n</document>`,
          },
        ],
      }),
    })
  } catch {
    res.status(502).json({ error: 'Could not reach OpenRouter.' })
    return
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    console.error('OpenRouter error', upstream.status, detail.slice(0, 500))
    res.status(502).json({
      error: `The AI provider returned an error (HTTP ${upstream.status}).`,
    })
    return
  }

  const completion = (await upstream.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>
  } | null
  const content = completion?.choices?.[0]?.message?.content
  if (!content) {
    res.status(502).json({ error: 'The AI provider returned an empty response.' })
    return
  }

  const parsed = parseModelJson(content)
  if (parsed === null || typeof parsed !== 'object') {
    res.status(502).json({ error: "The AI response wasn't valid JSON." })
    return
  }

  res.status(200).json(parsed)
}
