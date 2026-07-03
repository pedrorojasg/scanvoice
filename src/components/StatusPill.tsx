import type { InvoiceStatus } from '@/types'
import { STATUS_LABELS } from '@/types'
import { cn } from '@/lib/utils'

export const STATUS_STYLES: Record<
  InvoiceStatus,
  { pill: string; dot: string }
> = {
  draft: { pill: 'bg-st-draft-tint text-st-draft', dot: 'bg-st-draft' },
  open: { pill: 'bg-st-open-tint text-st-open', dot: 'bg-st-open' },
  'partially paid': { pill: 'bg-st-partial-tint text-st-partial', dot: 'bg-st-partial' },
  paid: { pill: 'bg-st-paid-tint text-st-paid', dot: 'bg-st-paid' },
  canceled: { pill: 'bg-st-cancel-tint text-st-cancel', dot: 'bg-st-cancel' },
}

export function StatusPill({ status }: { status: InvoiceStatus }) {
  const styles = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
        styles.pill,
      )}
    >
      <span className={cn('size-1.5 rounded-full', styles.dot)} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  )
}
