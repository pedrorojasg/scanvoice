import { useMemo, useState } from 'react'

export interface TableControls<T> {
  query: string
  setQuery: (q: string) => void
  page: number
  setPage: (p: number) => void
  pageCount: number
  pageItems: T[]
  filteredCount: number
  totalCount: number
  /** 1-based index of the first/last visible row, 0 when empty. */
  rangeStart: number
  rangeEnd: number
}

/** Frontend search + client-side pagination; changing the search resets to page 1. */
export function useTableControls<T>(
  items: T[],
  matches: (item: T, normalizedQuery: string) => boolean,
  perPage = 10,
): TableControls<T> {
  const [query, setQueryState] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter((item) => matches(item, normalized))
  }, [items, matches, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, pageCount)
  const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  return {
    query,
    setQuery: (q: string) => {
      setQueryState(q)
      setPage(1)
    },
    page: safePage,
    setPage,
    pageCount,
    pageItems,
    filteredCount: filtered.length,
    totalCount: items.length,
    rangeStart: filtered.length === 0 ? 0 : (safePage - 1) * perPage + 1,
    rangeEnd: Math.min(safePage * perPage, filtered.length),
  }
}
