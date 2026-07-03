import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PlusIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import type { Invoice, InvoiceLineItem, InvoiceStatus } from '@/types'
import { INVOICE_STATUSES, STATUS_LABELS } from '@/types'
import { deleteInvoice, getInvoice, listProducts, saveInvoice } from '@/lib/storage'
import { clearPendingDraft, readPendingDraft } from '@/lib/extraction'
import {
  computeLineTotal,
  formatMoney,
  isPartialPayment,
  parseDecimal,
  sumDecimals,
} from '@/lib/decimal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

function Field({
  label,
  htmlFor,
  wide,
  children,
}: {
  label: string
  htmlFor: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <Label htmlFor={htmlFor} className="label-caps mb-1.5 block">
        {label}
      </Label>
      {children}
    </div>
  )
}

function emptyLineItem(): InvoiceLineItem {
  return {
    id: crypto.randomUUID(),
    product_name: '',
    product_barcode: null,
    unit_price: null,
    quantity: null,
    total_discounts: null,
    total_tax: null,
    total_amount: null,
    total_amount_paid: null,
  }
}

/** Normalize an ISO datetime to the YYYY-MM-DD a date input needs. */
const toDateInput = (iso: string | null): string => iso?.slice(0, 10) ?? ''

function NotFound({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border bg-card px-6 py-16 text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-[13px] text-ink-2">{body}</p>
      <div className="mt-2 flex gap-2">
        <Button render={<Link to="/scan" />}>Scan invoice</Button>
        <Button variant="outline" render={<Link to="/" />}>
          Back to invoices
        </Button>
      </div>
    </div>
  )
}

export function InvoiceEditorPage({ mode }: { mode: 'draft' | 'saved' }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [invoice, setInvoice] = useState<Invoice | null>(() =>
    mode === 'draft' ? readPendingDraft() : getInvoice(id ?? ''),
  )
  const knownProducts = useMemo(
    () => new Set(listProducts().map((p) => p.name)),
    [],
  )

  if (!invoice) {
    return mode === 'draft' ? (
      <NotFound
        title="No pending draft"
        body="Scan a PDF invoice first — the extracted draft opens here for review."
      />
    ) : (
      <NotFound
        title="Invoice not found"
        body="This invoice doesn't exist in local storage. It may have been deleted."
      />
    )
  }

  const set = <K extends keyof Invoice>(key: K, value: Invoice[K]) =>
    setInvoice({ ...invoice, [key]: value })

  const setText = (key: keyof Invoice) => (value: string) =>
    set(key, (value === '' ? null : value) as Invoice[typeof key])

  // Editing amount paid to something between 0 and the total flips the
  // status to "partially paid" automatically.
  const setAmountPaid = (value: string) => {
    const amount_paid = value === '' ? null : value
    const patch: Partial<Invoice> = { amount_paid }
    if (isPartialPayment(amount_paid, invoice.total_amount)) {
      patch.status = 'partially paid'
    }
    setInvoice({ ...invoice, ...patch })
  }

  const setItem = (itemId: string, patch: Partial<InvoiceLineItem>) =>
    set(
      'line_items',
      invoice.line_items.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    )

  // Fields that feed the line total; editing one recomputes total_amount.
  // Editing the total cell itself stays manual (no fighting the user).
  const LINE_TOTAL_INPUTS = ['unit_price', 'quantity', 'total_discounts', 'total_tax'] as const

  const itemText =
    (itemId: string, key: Exclude<keyof InvoiceLineItem, 'id' | 'product_name'>) =>
    (value: string) => {
      const patch: Partial<InvoiceLineItem> = { [key]: value === '' ? null : value }
      if ((LINE_TOTAL_INPUTS as readonly string[]).includes(key)) {
        const current = invoice.line_items.find((i) => i.id === itemId)
        if (current) {
          const total = computeLineTotal({ ...current, ...patch })
          if (total !== null) patch.total_amount = total
        }
      }
      setItem(itemId, patch)
    }

  const lineSum = sumDecimals(invoice.line_items.map((i) => i.total_amount))
  const parsedTotal = parseDecimal(invoice.total_amount)
  const totalsMismatch =
    invoice.line_items.length > 0 && parsedTotal !== null && !parsedTotal.eq(lineSum)

  const detectedNames = [
    ...new Set(invoice.line_items.map((i) => i.product_name.trim()).filter(Boolean)),
  ]
  const newProductCount = detectedNames.filter((n) => !knownProducts.has(n)).length

  const handleSave = () => {
    saveInvoice(invoice)
    if (mode === 'draft') clearPendingDraft()
    toast.success('Invoice saved', {
      description:
        detectedNames.length > 0
          ? `Product catalog updated from ${detectedNames.length} line ${detectedNames.length === 1 ? 'item' : 'items'}.`
          : undefined,
    })
    navigate('/')
  }

  const handleDiscard = () => {
    if (mode === 'draft') {
      clearPendingDraft()
      navigate('/scan')
    } else {
      navigate('/')
    }
  }

  const handleDelete = () => {
    deleteInvoice(invoice.id)
    toast.success('Invoice deleted')
    navigate('/')
  }

  const moneyInput = 'font-data text-right'

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[21px] font-semibold tracking-tight">
          {mode === 'draft' ? 'Draft invoice' : 'Edit invoice'}
        </h1>
        <p className="mt-0.5 text-[13px] text-ink-2">
          {mode === 'draft'
            ? 'Extracted by AI — review, correct, then save.'
            : 'Changes are stored when you save.'}
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* ---- Invoice document ---- */}
        <div className="rounded-xl border bg-card p-6 shadow-xs md:p-7">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b pb-5">
            <div>
              <div className="label-caps">Invoice number</div>
              <div className="font-data mt-0.5 text-[19px] font-semibold tracking-tight">
                {invoice.number ?? 'Unnumbered'}
              </div>
            </div>
            <div className="min-w-[180px]">
              <Label htmlFor="status" className="label-caps mb-1.5 block">
                Status
              </Label>
              <Select
                value={invoice.status}
                items={STATUS_LABELS}
                onValueChange={(v) => set('status', v as InvoiceStatus)}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-5 grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
            <Field label="Customer name" htmlFor="customer_name">
              <Input
                id="customer_name"
                value={invoice.customer_name ?? ''}
                onChange={(e) => setText('customer_name')(e.target.value)}
              />
            </Field>
            <Field label="Number" htmlFor="number">
              <Input
                id="number"
                className="font-data"
                value={invoice.number ?? ''}
                onChange={(e) => setText('number')(e.target.value)}
              />
            </Field>
            <Field label="Customer address" htmlFor="customer_address" wide>
              <Input
                id="customer_address"
                value={invoice.customer_address ?? ''}
                onChange={(e) => setText('customer_address')(e.target.value)}
              />
            </Field>
            <Field label="Opened date" htmlFor="opened_date">
              <Input
                id="opened_date"
                type="date"
                className="font-data"
                value={toDateInput(invoice.opened_date)}
                onChange={(e) => setText('opened_date')(e.target.value)}
              />
            </Field>
            <Field label="Due date" htmlFor="due_date">
              <Input
                id="due_date"
                type="date"
                className="font-data"
                value={toDateInput(invoice.due_date)}
                onChange={(e) => setText('due_date')(e.target.value)}
              />
            </Field>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">Line items</h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-brand-hover"
              onClick={() => set('line_items', [...invoice.line_items, emptyLineItem()])}
            >
              <PlusIcon data-icon="inline-start" />
              Add row
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[880px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b">
                  <th className="label-caps p-2 text-left">Product</th>
                  <th className="label-caps p-2 text-left">Barcode</th>
                  <th className="label-caps p-2 text-right">Unit price</th>
                  <th className="label-caps p-2 text-right">Qty</th>
                  <th className="label-caps p-2 text-right">Discounts</th>
                  <th className="label-caps p-2 text-right">Tax</th>
                  <th className="label-caps p-2 text-right">Total</th>
                  <th className="label-caps p-2 text-right">Paid</th>
                  <th aria-hidden="true" className="w-9" />
                </tr>
              </thead>
              <tbody>
                {invoice.line_items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-ink-2">
                      No line items — add a row or save the invoice without items.
                    </td>
                  </tr>
                ) : (
                  invoice.line_items.map((item, index) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="min-w-[220px] p-1.5">
                        <Input
                          aria-label={`Row ${index + 1} product name`}
                          className="h-7 text-[12.5px]"
                          value={item.product_name}
                          onChange={(e) => setItem(item.id, { product_name: e.target.value })}
                        />
                      </td>
                      <td className="w-[140px] p-1.5">
                        <Input
                          aria-label={`Row ${index + 1} barcode`}
                          className="font-data h-7 text-[12.5px]"
                          placeholder="—"
                          value={item.product_barcode ?? ''}
                          onChange={(e) => itemText(item.id, 'product_barcode')(e.target.value)}
                        />
                      </td>
                      {(
                        [
                          ['unit_price', 'unit price', 'w-[92px]'],
                          ['quantity', 'quantity', 'w-[72px]'],
                          ['total_discounts', 'discounts', 'w-[92px]'],
                          ['total_tax', 'tax', 'w-[92px]'],
                          ['total_amount', 'total', 'w-[100px]'],
                          ['total_amount_paid', 'amount paid', 'w-[100px]'],
                        ] as const
                      ).map(([key, label, width]) => (
                        <td key={key} className={`${width} p-1.5`}>
                          <Input
                            aria-label={`Row ${index + 1} ${label}`}
                            inputMode="decimal"
                            placeholder="—"
                            className={`${moneyInput} h-7 text-[12.5px]`}
                            value={item[key] ?? ''}
                            onChange={(e) => itemText(item.id, key)(e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="p-1.5 text-center">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Delete row ${index + 1}`}
                          className="text-ink-3 hover:bg-st-cancel-tint hover:text-st-cancel"
                          onClick={() =>
                            set(
                              'line_items',
                              invoice.line_items.filter((i) => i.id !== item.id),
                            )
                          }
                        >
                          <XIcon />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="ml-auto mt-4 flex w-full max-w-[300px] flex-col gap-2 text-[13px]">
            <div className="flex items-center justify-between gap-4">
              <span className="text-ink-2">Line items sum</span>
              <span className="font-data">{formatMoney(lineSum)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="amount_paid" className="font-normal text-ink-2">
                Amount paid
              </Label>
              <Input
                id="amount_paid"
                inputMode="decimal"
                className={`${moneyInput} h-8 w-[130px]`}
                placeholder="0.00"
                value={invoice.amount_paid ?? ''}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-4 border-t pt-2 font-semibold">
              <Label htmlFor="total_amount">Total amount</Label>
              <Input
                id="total_amount"
                inputMode="decimal"
                className={`${moneyInput} h-8 w-[130px] font-semibold`}
                placeholder="0.00"
                value={invoice.total_amount ?? ''}
                onChange={(e) => setText('total_amount')(e.target.value)}
              />
            </div>
          </div>

          {totalsMismatch && (
            <div className="mt-4 flex items-start gap-2.5 rounded-md border border-warn-border bg-st-partial-tint px-3.5 py-2.5 text-[12.5px] text-warn-ink">
              <TriangleAlertIcon className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
              <span>
                Line items add up to <strong className="font-data">{formatMoney(lineSum)}</strong>{' '}
                but the invoice total is{' '}
                <strong className="font-data">{formatMoney(invoice.total_amount)}</strong>. The
                document may include shipping or fees — you can still save.
              </span>
            </div>
          )}

          <div className="mt-5 grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
            <Field label="Note" htmlFor="note" wide>
              <Input
                id="note"
                value={invoice.note ?? ''}
                onChange={(e) => setText('note')(e.target.value)}
              />
            </Field>
            <Field label="Net terms / other notes" htmlFor="net_terms" wide>
              <Textarea
                id="net_terms"
                rows={2}
                value={invoice.net_terms_other_notes ?? ''}
                onChange={(e) => setText('net_terms_other_notes')(e.target.value)}
              />
            </Field>
          </div>
        </div>

        {/* ---- Action panel ---- */}
        <div className="rounded-xl border bg-card p-5 lg:sticky lg:top-7">
          <h2 className="text-[13px] font-semibold">
            {mode === 'draft' ? 'Save this draft' : 'Save changes'}
          </h2>
          <p className="mb-4 mt-1 text-[12.5px] text-ink-2">
            Saving stores the invoice locally and updates the product catalog from its line
            items.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={handleSave}>Save invoice</Button>
            <Button variant="outline" onClick={handleDiscard}>
              {mode === 'draft' ? 'Discard draft' : 'Discard changes'}
            </Button>
            {mode === 'saved' && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="destructive">Delete invoice…</Button>}
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {invoice.number ?? 'This invoice'} will be removed from local storage.
                      Products already in the catalog are kept. This can't be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Delete invoice
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <dl className="mt-4 flex flex-col gap-2 border-t pt-4 text-xs text-ink-2">
            <div className="flex justify-between gap-3">
              <dt>Products detected</dt>
              <dd className="font-data">
                {detectedNames.length}
                {newProductCount > 0 && ` (${newProductCount} new)`}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Amounts</dt>
              <dd className="font-data">decimal strings</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Model</dt>
              <dd className="font-data">deepseek-v4-flash</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
