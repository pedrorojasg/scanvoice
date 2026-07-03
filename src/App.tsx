import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/layout/AppShell'
import { InvoicesPage } from '@/pages/InvoicesPage'
import { InvoiceEditorPage } from '@/pages/InvoiceEditorPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { ScanPage } from '@/pages/ScanPage'

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<InvoicesPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/invoices/draft" element={<InvoiceEditorPage mode="draft" />} />
          <Route path="/invoices/:id" element={<InvoiceEditorPage mode="saved" />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster position="bottom-right" />
    </>
  )
}
