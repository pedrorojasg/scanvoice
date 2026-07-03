export const INVOICE_STATUSES = [
  'draft',
  'open',
  'partially paid',
  'paid',
  'canceled',
] as const

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  'partially paid': 'Partially paid',
  paid: 'Paid',
  canceled: 'Canceled',
}

export interface InvoiceLineItem {
  id: string
  product_name: string
  product_barcode: string | null
  unit_price: string | null
  quantity: string | null
  total_discounts: string | null
  total_tax: string | null
  total_amount: string | null
  total_amount_paid: string | null
}

export interface Invoice {
  id: string
  status: InvoiceStatus
  number: string | null
  note: string | null
  opened_date: string | null
  due_date: string | null
  customer_name: string | null
  customer_address: string | null
  total_amount: string | null
  amount_paid: string | null
  net_terms_other_notes: string | null
  line_items: InvoiceLineItem[]
  created_at: string
  updated_at: string
}

export interface Product {
  name: string
  barcode: string | null
  last_unit_price: string | null
}
