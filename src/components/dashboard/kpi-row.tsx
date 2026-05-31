import { DollarSign, Scissors, UserPlus, Percent, TrendingUp, type LucideIcon } from "lucide-react";
import { kpis } from "@/lib/dashboard/sample-data";

const ICONS: Record<string, { Icon: LucideIcon; c: string }> = {
  revenue: { Icon: DollarSign, c: "#34d399" },
  cut: { Icon: Scissors, c: "#a78bfa" },
  clients: { Icon: UserPlus, c: "#60a5fa" },
  commission: { Icon: Percent, c: "#d4a574" },
};

export function KpiRow() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi, i) => {
        const { Icon, c } = ICONS[kpi.icon];
        return (
          <div
            key={kpi.key}
            className="surface-card rise-in p-5 transition-colors hover:border-white/[0.12]"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              className="kpi-icon"
              style={{
                color: c,
                backgroundImage: `linear-gradient(135deg, ${c}26, ${c}0d)`,
                border: `1px solid ${c}2e`,
                boxShadow: `inset 0 1px 0 0 ${c}30, 0 6px 16px -6px ${c}66`,
              }}
            >
              <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.25} />
            </div>

            <p className="mt-4 text-[0.75rem] font-medium text-[var(--text-secondary)]">
              {kpi.label}
            </p>
            <p className="mt-1.5 text-[2.125rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-foreground tabular-nums">
              {kpi.value}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[0.6875rem]">
              <span className="flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-400 tabular-nums">
                <TrendingUp className="h-2.5 w-2.5" strokeWidth={3} />
                {kpi.delta}%
              </span>
              <span className="text-[var(--text-tertiary)]">vs ontem</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
