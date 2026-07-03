import Big from 'big.js'
import type { Invoice, InvoiceStatus, Product } from '@/types'
import { INVOICE_STATUSES } from '@/types'
import { sumDecimals } from '@/lib/decimal'

/**
 * localStorage-backed repository. The only module that touches storage —
 * swap these functions for API calls to move off localStorage later.
 */
const INVOICES_KEY = 'scanvoice.invoices'
const PRODUCTS_KEY = 'scanvoice.products'
const SEEDED_KEY = 'scanvoice.seeded'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function listInvoices(): Invoice[] {
  const invoices = readJson<Invoice[]>(INVOICES_KEY, [])
  return [...invoices].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getInvoice(id: string): Invoice | null {
  return readJson<Invoice[]>(INVOICES_KEY, []).find((i) => i.id === id) ?? null
}

/**
 * Insert or update an invoice, then upsert its line items into the product
 * catalog: products are keyed by unique name, and last_unit_price/barcode
 * always reflect the most recently saved invoice that mentions the product.
 */
export function saveInvoice(invoice: Invoice): Invoice {
  const now = new Date().toISOString()
  const invoices = readJson<Invoice[]>(INVOICES_KEY, [])
  const existing = invoices.findIndex((i) => i.id === invoice.id)
  const saved: Invoice = {
    ...invoice,
    created_at: existing >= 0 ? invoices[existing].created_at : invoice.created_at || now,
    updated_at: now,
  }
  if (existing >= 0) invoices[existing] = saved
  else invoices.push(saved)
  writeJson(INVOICES_KEY, invoices)
  upsertProductsFrom(saved)
  return saved
}

export function deleteInvoice(id: string): void {
  const invoices = readJson<Invoice[]>(INVOICES_KEY, [])
  writeJson(
    INVOICES_KEY,
    invoices.filter((i) => i.id !== id),
  )
}

export function listProducts(): Product[] {
  return readJson<Product[]>(PRODUCTS_KEY, []).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}

function upsertProductsFrom(invoice: Invoice): void {
  const products = readJson<Product[]>(PRODUCTS_KEY, [])
  const byName = new Map(products.map((p) => [p.name, p]))
  for (const item of invoice.line_items) {
    const name = item.product_name.trim()
    if (!name) continue
    const current = byName.get(name) ?? {
      name,
      barcode: null,
      last_unit_price: null,
    }
    byName.set(name, {
      name,
      barcode: item.product_barcode?.trim() ? item.product_barcode.trim() : current.barcode,
      last_unit_price: item.unit_price ?? current.last_unit_price,
    })
  }
  writeJson(PRODUCTS_KEY, [...byName.values()])
}

export interface StatusSummary {
  status: InvoiceStatus
  total: Big
  count: number
}

export function summarizeByStatus(invoices: Invoice[]): StatusSummary[] {
  return INVOICE_STATUSES.map((status) => {
    const matching = invoices.filter((i) => i.status === status)
    return {
      status,
      total: sumDecimals(matching.map((i) => i.total_amount)),
      count: matching.length,
    }
  })
}

export function isSeeded(): boolean {
  return localStorage.getItem(SEEDED_KEY) === '1'
}

export function markSeeded(): void {
  localStorage.setItem(SEEDED_KEY, '1')
}

export function hasAnyData(): boolean {
  return readJson<Invoice[]>(INVOICES_KEY, []).length > 0
}
