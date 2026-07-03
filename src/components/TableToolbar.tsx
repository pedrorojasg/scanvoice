import { SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function TableToolbar({
  query,
  onQueryChange,
  placeholder,
  rangeStart,
  rangeEnd,
  filteredCount,
}: {
  query: string
  onQueryChange: (q: string) => void
  placeholder: string
  rangeStart: number
  rangeEnd: number
  filteredCount: number
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
      <div className="relative w-full max-w-[340px]">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-3"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="bg-paper pl-9"
        />
      </div>
      <span className="ml-auto text-xs text-ink-3">
        {filteredCount === 0
          ? 'No results'
          : `Showing ${rangeStart}–${rangeEnd} of ${filteredCount}`}
      </span>
    </div>
  )
}
