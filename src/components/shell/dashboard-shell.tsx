import Link from "next/link";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  Wallet,
  Stamp,
  UsersRound,
  BarChart3,
  Megaphone,
  Settings,
  Crown,
  ChevronsUpDown,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Avatar } from "@/components/dashboard/primitives";

type NavItem = { label: string; icon: LucideIcon; href?: string; active?: boolean };

const OWNER_NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", active: true },
  { label: "Agenda", icon: Calendar },
  { label: "Clientes", icon: Users },
  { label: "Serviços", icon: Scissors },
  { label: "Financeiro", icon: Wallet },
  { label: "Fidelidade", icon: Stamp },
  { label: "Equipe", icon: UsersRound },
  { label: "Relatórios", icon: BarChart3 },
  { label: "Marketing", icon: Megaphone },
  { label: "Configurações", icon: Settings },
];

const BARBER_NAV: NavItem[] = [
  { label: "Minha Agenda", icon: Calendar, href: "/agenda", active: true },
  { label: "Clientes", icon: Users },
  { label: "Histórico", icon: BarChart3 },
  { label: "Configurações", icon: Settings },
];

export function DashboardShell({
  role = "owner",
  displayName,
  email,
  children,
}: {
  role?: "owner" | "barber";
  displayName: string;
  email: string;
  children: React.ReactNode;
}) {
  const NAV = role === "owner" ? OWNER_NAV : BARBER_NAV;
  const roleLabel = role === "owner" ? "Proprietário" : "Barbeiro";
  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Sidebar ── */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[var(--sidebar-bg)] lg:flex">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#e8c89a] to-[#c8995f] shadow-[0_4px_14px_rgba(212,165,116,0.3)]">
            <span className="text-lg font-extrabold text-[#0b0f17]">B</span>
          </div>
          <div className="leading-none">
            <p className="text-[0.9375rem] font-bold tracking-tight text-foreground">
              BARBERFLOW
            </p>
            <p className="mt-1 text-[0.625rem] font-medium tracking-[0.2em] text-[#d4a574]">
              PROFESSIONAL
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="flex flex-col gap-0.5">
            {NAV.map((item) =>
              item.href && item.active ? (
                <li key={item.label}>
                  <Link href={item.href} className="side-nav" data-active="true">
                    <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                    {item.label}
                  </Link>
                </li>
              ) : (
                <li key={item.label}>
                  <button className="side-nav w-full" type="button">
                    <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                    {item.label}
                  </button>
                </li>
              ),
            )}
          </ul>
        </nav>

        {/* Plan card — owner only */}
        {role === "owner" && (
          <div className="px-3 pb-3">
            <div className="rounded-xl border border-[#d4a574]/20 bg-gradient-to-b from-[#d4a574]/[0.08] to-transparent p-4">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-[#d4a574]" strokeWidth={2} />
                <p className="text-sm font-semibold text-foreground">Plano Profissional</p>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Seu plano atual</p>
              <p className="text-xs text-[var(--text-tertiary)]">Renova em 25 dias</p>
              <button
                type="button"
                className="mt-3 w-full rounded-lg bg-white/[0.04] py-2 text-xs font-semibold text-foreground transition-colors hover:bg-white/[0.08]"
              >
                Gerenciar Plano
              </button>
            </div>
          </div>
        )}

        {/* User footer */}
        <div className="border-t border-white/[0.06] p-3">
          <form action={signOut}>
            <button
              type="submit"
              className="group flex w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.04]"
              title="Sair"
            >
              <Avatar name={displayName} size={36} />
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold text-foreground">
                  {displayName}
                </p>
                <p className="truncate text-xs text-[var(--text-secondary)]">{roleLabel}</p>
              </div>
              <LogOut className="hidden h-4 w-4 text-[var(--text-tertiary)] group-hover:block" />
              <ChevronsUpDown className="h-4 w-4 text-[var(--text-tertiary)] group-hover:hidden" />
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
