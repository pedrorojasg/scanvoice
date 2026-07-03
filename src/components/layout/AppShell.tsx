import { NavLink, Outlet } from 'react-router-dom'
import { FileTextIcon, PackageIcon, ScanLineIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Invoices', icon: FileTextIcon, end: true },
  { to: '/scan', label: 'Scan invoice', icon: ScanLineIcon, end: false },
  { to: '/products', label: 'Products', icon: PackageIcon, end: false },
]

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-[30px] flex-none place-items-center rounded-[7px] bg-brand font-data text-[13px] font-bold text-white">
        S
      </div>
      <div>
        <div className="text-[15px] font-bold tracking-tight leading-tight">Scanvoice</div>
        <div className="text-[10.5px] uppercase tracking-[0.06em] text-ink-3">
          AI invoice scraper
        </div>
      </div>
    </div>
  )
}

function NavItems({ className }: { className?: string }) {
  return (
    <>
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-[13.5px] text-ink-2 hover:bg-paper',
              isActive && 'bg-brand-tint font-semibold text-brand-hover hover:bg-brand-tint',
              className,
            )
          }
        >
          <Icon className="size-[15px] flex-none" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </>
  )
}

export function AppShell() {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[228px] flex-none flex-col gap-0.5 border-r bg-card px-3.5 py-5 md:flex">
        <div className="px-2.5 pb-4">
          <Brand />
        </div>
        <div className="label-caps px-2.5 pb-1.5 pt-3">Workspace</div>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          <NavItems />
        </nav>
        <div className="mt-auto border-t px-2.5 pt-3 text-[11.5px] leading-relaxed text-ink-3">
          Invoices and products are stored locally in this browser.
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3 md:hidden">
          <Brand />
          <nav aria-label="Main" className="flex gap-1">
            <NavItems className="px-2 py-1.5 text-xs" />
          </nav>
        </header>
        <main className="px-4 py-6 md:px-9 md:py-7">
          <div className="mx-auto max-w-[1180px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
