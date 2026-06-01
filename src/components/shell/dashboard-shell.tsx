'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
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

type NavItem = { label: string; icon: LucideIcon; href?: string };

const OWNER_NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Agenda", icon: Calendar, href: "/dashboard/agenda" },
  { label: "Clientes", icon: Users },
  { label: "Serviços", icon: Scissors, href: "/dashboard/servicos" },
  { label: "Financeiro", icon: Wallet },
  { label: "Fidelidade", icon: Stamp },
  { label: "Equipe", icon: UsersRound, href: "/dashboard/equipe" },
  { label: "Relatórios", icon: BarChart3 },
  { label: "Marketing", icon: Megaphone },
  { label: "Configurações", icon: Settings },
];

const BARBER_NAV: NavItem[] = [
  { label: "Minha Agenda", icon: Calendar, href: "/agenda" },
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
  const pathname = usePathname();

  function isActive(item: NavItem): boolean {
    if (!item.href) return false;
    // Dashboard exact match to avoid /dashboard/equipe also matching /dashboard
    if (item.href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(item.href);
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Sidebar ── */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[var(--sidebar-bg)] lg:flex">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ecd0a4] to-[#c8995f] shadow-[0_6px_18px_-4px_rgba(212,165,116,0.5)] ring-1 ring-inset ring-white/20">
            <span className="text-[1.0625rem] font-extrabold text-[#0b0f17]">B</span>
          </div>
          <div className="leading-none">
            <p className="text-[0.9375rem] font-bold tracking-[-0.01em] text-foreground">
              BARBERFLOW
            </p>
            <p className="mt-1 text-[0.625rem] font-semibold tracking-[0.22em] text-[#d4a574]">
              PROFESSIONAL
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <p className="px-3 pb-2 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Menu
          </p>
          <ul className="flex flex-col gap-0.5">
            {NAV.map((item) =>
              item.href ? (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="side-nav"
                    data-active={isActive(item) ? "true" : undefined}
                  >
                    <span className="nav-ico">
                      <item.icon className="h-[17px] w-[17px]" strokeWidth={2} />
                    </span>
                    {item.label}
                  </Link>
                </li>
              ) : (
                <li key={item.label}>
                  <button className="side-nav w-full" type="button">
                    <span className="nav-ico">
                      <item.icon className="h-[17px] w-[17px]" strokeWidth={2} />
                    </span>
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
            <div className="rounded-xl border border-[#d4a574]/20 bg-gradient-to-b from-[#d4a574]/[0.08] to-transparent p-4 shadow-[inset_0_1px_0_rgba(212,165,116,0.12)] transition-colors hover:border-[#d4a574]/35">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-[#d4a574]" strokeWidth={2} fill="rgba(212,165,116,0.25)" />
                <p className="text-[0.8125rem] font-semibold text-foreground">Plano Profissional</p>
              </div>
              <p className="mt-1.5 text-xs text-[var(--text-secondary)]">Seu plano atual</p>
              <p className="text-xs text-[var(--text-tertiary)]">Renova em 25 dias</p>
              <button
                type="button"
                className="mt-3 w-full rounded-lg bg-gradient-to-b from-[#e8c89a] to-[#d4a574] py-2 text-xs font-bold text-[#0b0f17] shadow-[0_4px_12px_-4px_rgba(212,165,116,0.5)] transition-opacity hover:opacity-90"
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
