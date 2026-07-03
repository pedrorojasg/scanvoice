import type Big from 'big.js'
import type { InvoiceStatus } from '@/types'
import { STATUS_LABELS } from '@/types'
import { formatMoney } from '@/lib/decimal'
import { STATUS_STYLES } from '@/components/StatusPill'
import { cn } from '@/lib/utils'

export function StatCard({
  status,
  total,
  count,
}: {
  status: InvoiceStatus
  total: Big
  count: number
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3.5">
      <div className="label-caps flex items-center gap-1.5 !text-ink-2">
        <span
          className={cn('size-2 rounded-full', STATUS_STYLES[status].dot)}
          aria-hidden="true"
        />
        {STATUS_LABELS[status]}
      </div>
      <div className="font-data mt-2 text-[22px] font-semibold leading-tight tracking-tight">
        {formatMoney(total)}
      </div>
      <div className="mt-0.5 text-xs text-ink-3">
        {count} {count === 1 ? 'invoice' : 'invoices'}
      </div>
    </div>
  )
}
