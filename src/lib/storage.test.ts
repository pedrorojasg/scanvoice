import { beforeEach, describe, expect, it } from 'vitest'
import type { Invoice, InvoiceLineItem } from '@/types'
import {
  deleteInvoice,
  getInvoice,
  listInvoices,
  listProducts,
  saveInvoice,
  summarizeByStatus,
} from './storage'

// storage.ts runs in the browser; tests provide a minimal in-memory localStorage.
function installLocalStorage() {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

let counter = 0
function item(patch: Partial<InvoiceLineItem>): InvoiceLineItem {
  counter += 1
  return {
    id: `item-${counter}`,
    product_name: '',
    product_barcode: null,
    unit_price: null,
    quantity: null,
    total_discounts: null,
    total_tax: null,
    total_amount: null,
    total_amount_paid: null,
    ...patch,
  }
}

function invoice(patch: Partial<Invoice>): Invoice {
  counter += 1
  return {
    id: `inv-${counter}`,
    status: 'draft',
    number: null,
    note: null,
    opened_date: null,
    due_date: null,
    customer_name: null,
    customer_address: null,
    total_amount: null,
    amount_paid: null,
    net_terms_other_notes: null,
    line_items: [],
    created_at: '',
    updated_at: '',
    ...patch,
  }
}

beforeEach(installLocalStorage)

describe('saveInvoice', () => {
  it('inserts, then updates in place keeping created_at', () => {
    const saved = saveInvoice(invoice({ id: 'a', number: 'INV-1' }))
    expect(saved.created_at).not.toBe('')

    const updated = saveInvoice({ ...saved, number: 'INV-1-fixed' })
    expect(updated.created_at).toBe(saved.created_at)
    expect(listInvoices()).toHaveLength(1)
    expect(getInvoice('a')?.number).toBe('INV-1-fixed')
  })

  it('respects a pre-set created_at on first save (seed data)', () => {
    const saved = saveInvoice(invoice({ created_at: '2026-01-01T00:00:00.000Z' }))
    expect(saved.created_at).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('product derivation', () => {
  it('upserts products keyed by name, last price wins', () => {
    saveInvoice(
      invoice({
        line_items: [
          item({ product_name: 'Pallet', product_barcode: '842123', unit_price: '9.60' }),
        ],
      }),
    )
    saveInvoice(
      invoice({
        line_items: [item({ product_name: 'Pallet', unit_price: '9.80' })],
      }),
    )
    const products = listProducts()
    expect(products).toHaveLength(1)
    expect(products[0].last_unit_price).toBe('9.80')
    // barcode survives a later line item without one
    expect(products[0].barcode).toBe('842123')
  })

  it('keeps the previous price when the latest line item has none', () => {
    saveInvoice(invoice({ line_items: [item({ product_name: 'Tape', unit_price: '22.10' })] }))
    saveInvoice(invoice({ line_items: [item({ product_name: 'Tape' })] }))
    expect(listProducts()[0].last_unit_price).toBe('22.10')
  })

  it('ignores items with empty names and trims whitespace', () => {
    saveInvoice(
      invoice({
        line_items: [
          item({ product_name: '  ' }),
          item({ product_name: ' Gloves ', unit_price: '8.15' }),
        ],
      }),
    )
    const products = listProducts()
    expect(products).toHaveLength(1)
    expect(products[0].name).toBe('Gloves')
  })
})

describe('summarizeByStatus', () => {
  it('sums totals per status with decimal-safe arithmetic', () => {
    const invoices = [
      invoice({ status: 'open', total_amount: '0.1' }),
      invoice({ status: 'open', total_amount: '0.2' }),
      invoice({ status: 'paid', total_amount: '100' }),
      invoice({ status: 'draft', total_amount: null }),
    ]
    const summary = summarizeByStatus(invoices)
    expect(summary.find((s) => s.status === 'open')?.total.eq('0.3')).toBe(true)
    expect(summary.find((s) => s.status === 'paid')?.total.eq('100')).toBe(true)
    expect(summary.find((s) => s.status === 'draft')?.count).toBe(1)
    expect(summary.find((s) => s.status === 'canceled')?.count).toBe(0)
  })
})

describe('deleteInvoice', () => {
  it('removes the invoice but keeps derived products', () => {
    const saved = saveInvoice(
      invoice({ line_items: [item({ product_name: 'Labels', unit_price: '6.90' })] }),
    )
    deleteInvoice(saved.id)
    expect(listInvoices()).toHaveLength(0)
    expect(listProducts()).toHaveLength(1)
  })
})
