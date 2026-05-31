import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CalendarDays, RefreshCw, Bell } from "lucide-react";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { TodayAgenda } from "@/components/dashboard/today-agenda";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { UpcomingAppointments } from "@/components/dashboard/upcoming-appointments";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentClients } from "@/components/dashboard/recent-clients";
import { LoyaltyHighlight } from "@/components/dashboard/loyalty-highlight";

export const metadata: Metadata = {
  title: "Dashboard — BarberFlow",
};

function greetingFor(): string {
  const hour = parseInt(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
    10,
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/entrar");

  const claims = data.claims;
  const email = (claims.email as string | undefined) ?? "";
  const userId = claims.sub as string;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const handle = email.split("@")[0] ?? "Dono";
  const derived = handle.split(/[._-]/)[0];
  const displayName =
    profile?.full_name?.trim() ||
    derived.charAt(0).toUpperCase() + derived.slice(1);
  const firstName = displayName.split(" ")[0];

  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <DashboardShell displayName={displayName} email={email}>
      <div className="px-5 py-6 lg:px-8 lg:py-7">
        {/* ── Top header ── */}
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-[1.625rem] font-bold tracking-tight text-foreground">
              {greetingFor()}, {firstName}!{" "}
              <span className="text-2xl" aria-hidden>
                👋
              </span>
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Aqui está o que está acontecendo na sua barbearia hoje.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button type="button" className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.06]">
              <CalendarDays className="h-4 w-4 text-[var(--text-secondary)]" />
              <span className="capitalize">{dateLabel}</span>
            </button>
            <button type="button" className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.06]">
              <RefreshCw className="h-4 w-4 text-[var(--text-secondary)]" />
              Atualizar dados
            </button>
            <button type="button" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-foreground transition-colors hover:bg-white/[0.06]">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#d4a574] text-[0.625rem] font-bold text-[#0b0f17]">
                3
              </span>
            </button>
          </div>
        </header>

        {/* ── KPIs ── */}
        <KpiRow />

        {/* ── Main grid ── */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="flex flex-col gap-4 xl:col-span-4">
            <TodayAgenda />
            <QuickActions />
          </div>
          <div className="flex flex-col gap-4 xl:col-span-5">
            <RevenueChart />
            <RecentClients />
          </div>
          <div className="flex flex-col gap-4 xl:col-span-3">
            <UpcomingAppointments />
            <LoyaltyHighlight />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
