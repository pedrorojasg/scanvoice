import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function TablePagination({
  page,
  pageCount,
  onPageChange,
  perPage,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  perPage: number
}) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1)
  return (
    <div className="flex items-center gap-1.5 border-t px-4 py-3 text-xs text-ink-2">
      <span>{perPage} per page</span>
      <div className="ml-auto flex gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          ‹
        </Button>
        {pages.map((p) => (
          <Button
            key={p}
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              p === page &&
                'border-ink bg-ink text-white hover:bg-ink hover:text-white',
            )}
          >
            {p}
          </Button>
        ))}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          ›
        </Button>
      </div>
    </div>
  )
}
