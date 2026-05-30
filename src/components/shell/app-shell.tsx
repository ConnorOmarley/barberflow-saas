import Link from 'next/link'
import {
  Scissors,
  LayoutDashboard,
  CalendarDays,
  Users,
  Wallet,
  Clock,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'

type NavItem = {
  label: string
  href?: string
  icon: LucideIcon
  active?: boolean
  soon?: boolean
}

const OWNER_NAV: NavItem[] = [
  { label: 'Visão geral', href: '/dashboard', icon: LayoutDashboard, active: true },
  { label: 'Agenda', icon: CalendarDays, soon: true },
  { label: 'Serviços', icon: Scissors, soon: true },
  { label: 'Barbeiros', icon: Users, soon: true },
  { label: 'Financeiro', icon: Wallet, soon: true },
]

const BARBER_NAV: NavItem[] = [
  { label: 'Minha agenda', href: '/agenda', icon: CalendarDays, active: true },
  { label: 'Histórico', icon: Clock, soon: true },
]

function initials(email: string): string {
  const handle = email.split('@')[0] ?? ''
  const parts = handle.split(/[.\-_]/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : handle.slice(0, 2)
  return letters.toUpperCase()
}

export function AppShell({
  role,
  email,
  section,
  children,
}: {
  role: 'owner' | 'barber'
  email: string
  section: string
  children: React.ReactNode
}) {
  const nav = role === 'owner' ? OWNER_NAV : BARBER_NAV
  const roleLabel = role === 'owner' ? 'Dono' : 'Barbeiro'

  return (
    <div className="flex min-h-screen bg-[var(--shell-canvas)]">
      {/* ── Sidebar: same canvas as content, separated by a hairline ── */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[var(--shell-edge)]">
        {/* Brand */}
        <div className="flex items-center gap-2 px-5 h-16 shrink-0">
          <Scissors className="h-5 w-5 text-amber-600" strokeWidth={1.5} />
          <span className="font-display text-lg font-semibold tracking-wide text-foreground">
            BarberFlow
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2">
          <div className="flex items-center gap-2 px-3 pb-2">
            <span className="eyebrow">Gestão</span>
            <span className="h-px flex-1 bg-[var(--shell-edge)]" />
          </div>
          <ul className="flex flex-col gap-0.5">
            {nav.map((item) => {
              const content = (
                <>
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span className="flex-1">{item.label}</span>
                  {item.soon && (
                    <span className="text-[0.625rem] uppercase tracking-wide text-muted-foreground/70">
                      em breve
                    </span>
                  )}
                </>
              )
              return (
                <li key={item.label}>
                  {item.href && !item.soon ? (
                    <Link href={item.href} className="nav-item" data-active={item.active}>
                      {content}
                    </Link>
                  ) : (
                    <div className="nav-item" data-soon="true" aria-disabled>
                      {content}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User footer */}
        <div className="border-t border-[var(--shell-edge)] p-3">
          <div className="flex items-center gap-3 rounded-lg bg-[var(--shell-raised)] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-600/15 text-xs font-semibold text-amber-500 ring-1 ring-amber-600/25">
              {initials(email)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{email}</p>
              <p className="text-xs text-amber-500/90">{roleLabel}</p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                title="Sair"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
                <span className="sr-only">Sair</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--shell-edge)] px-6">
          <div className="flex items-center gap-3">
            {/* Mobile brand (sidebar hidden < md) */}
            <Scissors className="h-4 w-4 text-amber-600 md:hidden" strokeWidth={1.5} />
            <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
              {section}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:block">{email}</span>
            <form action={signOut} className="md:hidden">
              <button
                type="submit"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
                <span className="sr-only">Sair</span>
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  )
}
