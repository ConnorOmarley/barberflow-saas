import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { DashboardShell } from "@/components/shell/dashboard-shell";

export const metadata: Metadata = {
  title: "Minha Agenda — BarberFlow",
};

export default async function AgendaPage() {
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

  const handle = email.split("@")[0] ?? "Barbeiro";
  const derived = handle.split(/[._-]/)[0];
  const displayName =
    profile?.full_name?.trim() ||
    derived.charAt(0).toUpperCase() + derived.slice(1);

  return (
    <DashboardShell role="barber" displayName={displayName} email={email}>
      <div className="px-5 py-6 lg:px-8 lg:py-7">
        <header className="mb-6">
          <h1 className="text-[1.625rem] font-bold tracking-tight text-foreground">
            Minha Agenda
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Seus atendimentos confirmados aparecerão aqui, organizados por dia.
          </p>
        </header>

        <div className="surface-card flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="relative mb-7 h-24 w-48">
            <div className="absolute inset-0 flex flex-col justify-between opacity-30">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="h-px w-full bg-white/10" />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a574]/25 bg-[#d4a574]/10">
                <CalendarDays className="h-6 w-6 text-[#d4a574]" strokeWidth={1.75} />
              </div>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Nenhum agendamento ainda
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
            Quando o dono configurar os serviços e seus horários de trabalho,
            seus atendimentos confirmados aparecerão aqui.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
