import { DollarSign, Scissors, UserPlus, Percent, TrendingUp } from "lucide-react";
import { kpis } from "@/lib/dashboard/sample-data";

const ICONS = {
  revenue: { Icon: DollarSign, fg: "#34d399", bg: "rgba(16,185,129,0.12)" },
  cut: { Icon: Scissors, fg: "#a78bfa", bg: "rgba(139,92,246,0.14)" },
  clients: { Icon: UserPlus, fg: "#60a5fa", bg: "rgba(59,130,246,0.14)" },
  commission: { Icon: Percent, fg: "#d4a574", bg: "rgba(212,165,116,0.14)" },
} as const;

export function KpiRow() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi, i) => {
        const { Icon, fg, bg } = ICONS[kpi.icon];
        return (
          <div
            key={kpi.key}
            className="surface-card rise-in p-5"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="kpi-icon" style={{ backgroundColor: bg, color: fg }}>
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
            </div>
            <p className="mt-4 text-[0.8125rem] font-medium text-[var(--text-secondary)]">
              {kpi.label}
            </p>
            <p className="mt-1.5 text-[1.875rem] font-bold leading-none tracking-[-0.02em] text-foreground tabular-nums">
              {kpi.value}
            </p>
            <div className="mt-3.5 flex items-center gap-1.5 text-xs">
              <span className="flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-400 tabular-nums">
                <TrendingUp className="h-3 w-3" strokeWidth={2.5} />
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
