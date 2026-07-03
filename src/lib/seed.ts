import type { InvoiceLineItem, InvoiceStatus } from '@/types'
import { isSeeded, markSeeded, hasAnyData, saveInvoice } from '@/lib/storage'

let seedCounter = 0
function id(): string {
  // Deterministic-ish ids for seed data; real invoices use crypto.randomUUID()
  seedCounter += 1
  return `seed-${seedCounter.toString(36)}-${crypto.randomUUID().slice(0, 8)}`
}

interface SeedItem {
  name: string
  barcode?: string
  price: string
  qty: string
  tax?: string
  total: string
}

function items(defs: SeedItem[]): InvoiceLineItem[] {
  return defs.map((d) => ({
    id: id(),
    product_name: d.name,
    product_barcode: d.barcode ?? null,
    unit_price: d.price,
    quantity: d.qty,
    total_discounts: null,
    total_tax: d.tax ?? null,
    total_amount: d.total,
    total_amount_paid: null,
  }))
}

interface SeedInvoice {
  number: string
  status: InvoiceStatus
  customer: string
  address: string
  opened: string
  due: string | null
  total: string
  paid: string
  terms?: string
  note?: string
  items: SeedItem[]
}

const SEED: SeedInvoice[] = [
  {
    number: 'INV-2026-0172', status: 'paid', customer: 'Meridian Coffee Roasters',
    address: '18 Dockside Rd, Bristol BS1 6QF, United Kingdom',
    opened: '2026-04-02', due: '2026-05-02', total: '4310.50', paid: '4310.50', terms: 'Net 30',
    items: [
      { name: 'Single-origin espresso 1kg — Huila', barcode: '7701234098765', price: '28.40', qty: '120', tax: '340.80', total: '3748.80' },
      { name: 'Filter papers 185mm (box 100)', price: '5.62', qty: '100', total: '561.70' },
    ],
  },
  {
    number: 'F-000897', status: 'paid', customer: 'Talleres Ibáñez SA',
    address: 'Av. de la Industria 42, 28823 Coslada, Madrid',
    opened: '2026-04-10', due: '2026-05-10', total: '2890.00', paid: '2890.00', terms: 'Net 30 · IBAN ES91 2100 0418 4502 0005 1332',
    items: [
      { name: 'Guantes nitrilo T/M (caja 100)', barcode: '8434567800219', price: '8.15', qty: '200', tax: '342.30', total: '1972.30' },
      { name: 'Etiquetas térmicas 100×150 (rollo)', barcode: '8420987600031', price: '6.90', qty: '110', tax: '131.70', total: '917.70' },
    ],
  },
  {
    number: '2026-0588', status: 'paid', customer: 'Grupo Almar Logística',
    address: 'Polígono El Puche, Nave 7, 04009 Almería',
    opened: '2026-04-18', due: '2026-05-18', total: '6480.00', paid: '6480.00',
    items: [
      { name: 'Palet europeo EPAL 1200×800', barcode: '8421234567895', price: '9.60', qty: '500', tax: '1008.00', total: '5808.00' },
      { name: 'Cantoneras cartón 50×50×3 (pack 25)', price: '11.20', qty: '50', tax: '112.00', total: '672.00' },
    ],
  },
  {
    number: 'INV-2026-0179', status: 'paid', customer: 'Bluefin Analytics Ltd',
    address: '3rd Floor, 12 Fenwick St, Liverpool L2 7NE, United Kingdom',
    opened: '2026-05-04', due: '2026-06-03', total: '980.00', paid: '980.00', terms: 'Net 30',
    items: [{ name: 'Data pipeline support — May', price: '980.00', qty: '1', total: '980.00' }],
  },
  {
    number: 'F-000904', status: 'canceled', customer: 'Comercial Vega e Hijos',
    address: 'C/ Mayor 8, 30201 Cartagena, Murcia',
    opened: '2026-05-06', due: null, total: '1150.00', paid: '0',
    note: 'Pedido anulado por el cliente antes del envío.',
    items: [{ name: 'Caja cartón doble canal 60×40×40', barcode: '8423456011122', price: '1.85', qty: '500', tax: '194.25', total: '1119.25' }],
  },
  {
    number: 'INV-2026-0181', status: 'paid', customer: 'Harbor & Lane Interiors',
    address: '240 Greenpoint Ave, Brooklyn, NY 11222',
    opened: '2026-05-12', due: '2026-06-11', total: '1240.00', paid: '1240.00',
    items: [{ name: 'Sample kit — oak veneer set', price: '62.00', qty: '20', total: '1240.00' }],
  },
  {
    number: 'INV-2026-0182', status: 'partially paid', customer: 'Studio Ferran',
    address: 'Carrer de Pallars 108, 08018 Barcelona',
    opened: '2026-06-05', due: '2026-07-05', total: '2250.00', paid: '1125.00', terms: '50% on order, 50% on delivery',
    items: [{ name: 'Design retainer — monthly', price: '1125.00', qty: '2', total: '2250.00' }],
  },
  {
    number: '2026-0631', status: 'open', customer: 'Grupo Almar Logística',
    address: 'Polígono El Puche, Nave 7, 04009 Almería',
    opened: '2026-06-12', due: '2026-07-12', total: '3140.00', paid: '0',
    items: [
      { name: 'Film estirable 23µ transparente', barcode: '8421234512340', price: '14.10', qty: '180', tax: '533.00', total: '3071.00' },
      { name: 'Cinta adhesiva PP 48mm (pack 36)', price: '21.90', qty: '3', total: '69.00' },
    ],
  },
  {
    number: 'F-000918', status: 'open', customer: 'Talleres Ibáñez SA',
    address: 'Av. de la Industria 42, 28823 Coslada, Madrid',
    opened: '2026-06-14', due: '2026-07-14', total: '1890.00', paid: '0', terms: 'Net 30',
    items: [{ name: 'Guantes nitrilo T/M (caja 100)', barcode: '8434567800219', price: '8.40', qty: '190', tax: '294.00', total: '1890.00' }],
  },
  {
    number: 'F-000921', status: 'partially paid', customer: 'Talleres Ibáñez SA',
    address: 'Av. de la Industria 42, 28823 Coslada, Madrid',
    opened: '2026-06-15', due: '2026-07-15', total: '3960.75', paid: '2000.00', terms: 'Net 30',
    items: [
      { name: 'Etiquetas térmicas 100×150 (rollo)', barcode: '8420987600031', price: '6.90', qty: '300', tax: '434.70', total: '2504.70' },
      { name: 'Cinta adhesiva PP 48mm (pack 36)', price: '22.10', qty: '54', tax: '250.55', total: '1456.05' },
    ],
  },
  {
    number: 'INV-2026-0184', status: 'open', customer: 'Bluefin Analytics Ltd',
    address: '3rd Floor, 12 Fenwick St, Liverpool L2 7NE, United Kingdom',
    opened: '2026-06-18', due: '2026-07-18', total: '980.00', paid: '0', terms: 'Net 30',
    items: [{ name: 'Data pipeline support — June', price: '980.00', qty: '1', total: '980.00' }],
  },
  {
    number: '2026-0644', status: 'open', customer: 'Grupo Almar Logística',
    address: 'Polígono El Puche, Nave 7, 04009 Almería',
    opened: '2026-06-22', due: '2026-07-20', total: '7420.00', paid: '0',
    items: [
      { name: 'Palet europeo EPAL 1200×800', barcode: '8421234567895', price: '9.80', qty: '600', tax: '1234.80', total: '7114.80' },
      { name: 'Cantoneras cartón 50×50×3 (pack 25)', price: '11.35', qty: '22', tax: '52.43', total: '305.20' },
    ],
  },
  {
    number: 'INV-2026-0186', status: 'open', customer: 'Meridian Coffee Roasters',
    address: '18 Dockside Rd, Bristol BS1 6QF, United Kingdom',
    opened: '2026-06-26', due: '2026-07-28', total: '5180.00', paid: '0', terms: 'Net 30',
    items: [
      { name: 'Single-origin espresso 1kg — Huila', barcode: '7701234098765', price: '28.90', qty: '160', tax: '462.40', total: '5086.40' },
      { name: 'Filter papers 185mm (box 100)', price: '5.85', qty: '16', total: '93.60' },
    ],
  },
  {
    number: 'INV-2026-0187', status: 'draft', customer: 'Distribuciones Norte SL',
    address: 'Polígono Industrial A Granxa, Rúa D 14, 36400 O Porriño, Pontevedra',
    opened: '2026-06-28', due: '2026-07-28', total: '2400.00', paid: '0',
    note: 'Entrega en muelle 3, horario 8:00–14:00.',
    terms: 'Net 30 · IBAN ES91 2100 0418 4502 0005 1332',
    items: [
      { name: 'Film estirable 23µ transparente', barcode: '8421234512340', price: '14.25', qty: '48', tax: '143.64', total: '827.64' },
      { name: 'Palet europeo EPAL 1200×800', barcode: '8421234567895', price: '9.80', qty: '120', tax: '246.96', total: '1422.96' },
      { name: 'Cinta adhesiva PP 48mm (pack 36)', price: '22.10', qty: '4', tax: '18.56', total: '106.96' },
    ],
  },
]

/**
 * Replays demo invoices oldest-first through saveInvoice so the product
 * catalog is derived by the same upsert rules as real scans.
 */
export function loadDemoData(): void {
  for (const def of SEED) {
    saveInvoice({
      id: id(),
      status: def.status,
      number: def.number,
      note: def.note ?? null,
      opened_date: def.opened,
      due_date: def.due,
      customer_name: def.customer,
      customer_address: def.address,
      total_amount: def.total,
      amount_paid: def.paid,
      net_terms_other_notes: def.terms ?? null,
      line_items: items(def.items),
      created_at: `${def.opened}T09:00:00.000Z`,
      updated_at: `${def.opened}T09:00:00.000Z`,
    })
  }
  markSeeded()
}

/** Auto-seed once on first run so the demo looks alive without an API key. */
export function ensureSeeded(): void {
  if (isSeeded() || hasAnyData()) return
  loadDemoData()
}
