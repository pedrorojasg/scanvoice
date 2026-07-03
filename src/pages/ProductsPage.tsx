import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '@/types'
import { listProducts } from '@/lib/storage'
import { formatMoney } from '@/lib/decimal'
import { useTableControls } from '@/hooks/useTableControls'
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

const productMatches = (product: Product, q: string): boolean =>
  product.name.toLowerCase().includes(q) ||
  Boolean(product.barcode?.toLowerCase().includes(q))

export function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null)
  useEffect(() => {
    setProducts(listProducts())
  }, [])

  const matches = useCallback(productMatches, [])
  const controls = useTableControls(products ?? [], matches)

  if (products === null) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[21px] font-semibold tracking-tight">Products</h1>
        <p className="mt-0.5 text-[13px] text-ink-2">
          Read-only catalog, built automatically from imported invoice line items.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="font-semibold">No products yet</p>
            <p className="max-w-sm text-[13px] text-ink-2">
              Products appear here automatically when invoices are imported — each saved
              invoice adds its line items to this catalog.
            </p>
            <Button className="mt-2" render={<Link to="/scan" />}>
              Scan an invoice
            </Button>
          </div>
        ) : (
          <>
            <TableToolbar
              query={controls.query}
              onQueryChange={controls.setQuery}
              placeholder="Search by name or barcode…"
              rangeStart={controls.rangeStart}
              rangeEnd={controls.rangeEnd}
              filteredCount={controls.filteredCount}
            />
            <div className="overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="label-caps px-4">Product</TableHead>
                    <TableHead className="label-caps">Barcode</TableHead>
                    <TableHead className="label-caps px-4 text-right">
                      Last unit price
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {controls.pageItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="px-4 py-10 text-center text-ink-2">
                        No products match “{controls.query}”.
                      </TableCell>
                    </TableRow>
                  ) : (
                    controls.pageItems.map((product) => (
                      <TableRow key={product.name} className="hover:bg-transparent">
                        <TableCell className="px-4 font-medium">{product.name}</TableCell>
                        <TableCell className="font-data text-[13px]">
                          {product.barcode ?? <span className="text-ink-3">—</span>}
                        </TableCell>
                        <TableCell className="font-data px-4 text-right text-[13px]">
                          {formatMoney(product.last_unit_price)}
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
