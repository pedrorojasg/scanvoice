import { z } from 'zod'
import type { Invoice } from '@/types'

/**
 * Schema of the JSON the AI returns (see EXTRACTION_PROMPT.md). Decimals are
 * requested as strings, but models occasionally emit bare numbers — coerce
 * rather than fail the whole extraction over it.
 */
const decimalString = z
  .union([z.string(), z.number()])
  .nullable()
  .transform((v) => (v == null ? null : String(v).trim() || null))

const textField = z
  .string()
  .nullable()
  .transform((v) => (v?.trim() ? v.trim() : null))

const extractedLineItem = z.object({
  product_name: z.string().transform((v) => v.trim()),
  product_barcode: textField.catch(null),
  unit_price: decimalString.catch(null),
  quantity: decimalString.catch(null),
  total_discounts: decimalString.catch(null),
  total_tax: decimalString.catch(null),
  total_amount: decimalString.catch(null),
  total_amount_paid: decimalString.catch(null),
})

export const extractedInvoiceSchema = z.object({
  number: textField.catch(null),
  note: textField.catch(null),
  opened_date: textField.catch(null),
  due_date: textField.catch(null),
  customer_name: textField.catch(null),
  customer_address: textField.catch(null),
  total_amount: decimalString.catch(null),
  amount_paid: decimalString.catch(null),
  net_terms_other_notes: textField.catch(null),
  line_items: z.array(extractedLineItem).catch([]),
})

export type ExtractedInvoice = z.infer<typeof extractedInvoiceSchema>

export class ExtractionError extends Error {}

export async function requestExtraction(text: string): Promise<ExtractedInvoice> {
  let response: Response
  try {
    response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch {
    throw new ExtractionError(
      'Could not reach the extraction service. Check your connection and retry.',
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ExtractionError('The extraction service returned an unreadable response.')
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Extraction failed (HTTP ${response.status}).`
    throw new ExtractionError(message)
  }

  const parsed = extractedInvoiceSchema.safeParse(payload)
  if (!parsed.success) {
    throw new ExtractionError(
      "The AI response couldn't be validated against the invoice schema.",
    )
  }
  return parsed.data
}

/** Builds an unsaved draft Invoice from an AI extraction result. */
export function draftFromExtraction(extracted: ExtractedInvoice): Invoice {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    status: 'draft',
    number: extracted.number,
    note: extracted.note,
    opened_date: extracted.opened_date,
    due_date: extracted.due_date,
    customer_name: extracted.customer_name,
    customer_address: extracted.customer_address,
    total_amount: extracted.total_amount,
    amount_paid: extracted.amount_paid,
    net_terms_other_notes: extracted.net_terms_other_notes,
    line_items: extracted.line_items
      .filter((item) => item.product_name)
      .map((item) => ({ id: crypto.randomUUID(), ...item })),
    created_at: now,
    updated_at: now,
  }
}

const PENDING_DRAFT_KEY = 'scanvoice.pending_draft'

export function storePendingDraft(draft: Invoice): void {
  sessionStorage.setItem(PENDING_DRAFT_KEY, JSON.stringify(draft))
}

export function readPendingDraft(): Invoice | null {
  try {
    const raw = sessionStorage.getItem(PENDING_DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Invoice) : null
  } catch {
    return null
  }
}

export function clearPendingDraft(): void {
  sessionStorage.removeItem(PENDING_DRAFT_KEY)
}
