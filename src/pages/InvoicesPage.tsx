import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlusIcon } from 'lucide-react'
import type { Invoice } from '@/types'
import { STATUS_LABELS } from '@/types'
import { listInvoices, summarizeByStatus } from '@/lib/storage'
import { loadDemoData } from '@/lib/seed'
import { formatMoney } from '@/lib/decimal'
import { useTableControls } from '@/hooks/useTableControls'
import { StatCard } from '@/components/StatCard'
import { StatusPill } from '@/components/StatusPill'
import { TableToolbar } from '@/components/TableToolbar'
import { TablePagination } from '@/components/TablePagination'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

const invoiceMatches = (invoice: Invoice, q: string): boolean =>
  Boolean(
    invoice.number?.toLowerCase().includes(q) ||
      invoice.customer_name?.toLowerCase().includes(q) ||
      STATUS_LABELS[invoice.status].toLowerCase().includes(q),
  )

export function InvoicesPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  useEffect(() => {
    setInvoices(listInvoices())
  }, [])

  const matches = useCallback(invoiceMatches, [])
  const controls = useTableControls(invoices ?? [], matches)

  if (invoices === null) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  const summaries = summarizeByStatus(invoices)

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[21px] font-semibold tracking-tight">Invoices</h1>
          <p className="mt-0.5 text-[13px] text-ink-2">
            {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'} · stored locally
            in this browser
          </p>
        </div>
        <Button onClick={() => navigate('/scan')}>
          <PlusIcon data-icon="inline-start" />
          Scan invoice
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {summaries.map((s) => (
          <StatCard key={s.status} status={s.status} total={s.total} count={s.count} />
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="font-semibold">No invoices yet</p>
            <p className="max-w-sm text-[13px] text-ink-2">
              Scan a PDF invoice to create your first digital draft, or load the demo data to
              explore the dashboard.
            </p>
            <div className="mt-2 flex gap-2">
              <Button render={<Link to="/scan" />}>Scan invoice</Button>
              <Button
                variant="outline"
                onClick={() => {
                  loadDemoData()
                  setInvoices(listInvoices())
                }}
              >
                Load demo data
              </Button>
            </div>
          </div>
        ) : (
          <>
            <TableToolbar
              query={controls.query}
              onQueryChange={controls.setQuery}
              placeholder="Search by number, customer or status…"
              rangeStart={controls.rangeStart}
              rangeEnd={controls.rangeEnd}
              filteredCount={controls.filteredCount}
            />
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="label-caps px-4">Number</TableHead>
                    <TableHead className="label-caps">Customer</TableHead>
                    <TableHead className="label-caps">Status</TableHead>
                    <TableHead className="label-caps">Due date</TableHead>
                    <TableHead className="label-caps text-right">Total</TableHead>
                    <TableHead className="label-caps px-4 text-right">Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {controls.pageItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-4 py-10 text-center text-ink-2">
                        No invoices match “{controls.query}”.
                      </TableCell>
                    </TableRow>
                  ) : (
                    controls.pageItems.map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-data px-4 text-[13px]">
                          {invoice.number ?? '—'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {invoice.customer_name ?? '—'}
                        </TableCell>
                        <TableCell>
                          <StatusPill status={invoice.status} />
                        </TableCell>
                        <TableCell
                          className={invoice.due_date ? undefined : 'text-ink-3'}
                        >
                          {formatDate(invoice.due_date)}
                        </TableCell>
                        <TableCell className="font-data text-right text-[13px]">
                          {formatMoney(invoice.total_amount)}
                        </TableCell>
                        <TableCell className="font-data px-4 text-right text-[13px]">
                          {formatMoney(invoice.amount_paid, '$0.00')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              page={controls.page}
              pageCount={controls.pageCount}
              onPageChange={controls.setPage}
              perPage={10}
            />
          </>
        )}
      </div>
    </div>
  )
}
