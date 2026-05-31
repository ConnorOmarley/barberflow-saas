import { Crown, Scissors, ArrowRight } from "lucide-react";
import { loyaltyHighlight } from "@/lib/dashboard/sample-data";
import { Avatar, Panel, PanelHeader } from "./primitives";

export function LoyaltyHighlight() {
  const { client, tier, stamps, total, reward } = loyaltyHighlight;
  const remaining = total - stamps;

  return (
    <Panel className="flex h-full flex-col">
      <PanelHeader title="Fidelidade em Destaque" />

      <div className="flex flex-1 flex-col px-5 pb-5">
        {/* Client + tier */}
        <div className="flex items-center gap-3">
          <Avatar name={client} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{client}</p>
            <p className="text-xs text-[var(--text-secondary)]">Cliente fiel</p>
          </div>
          <span className="badge-pill flex items-center gap-1 bg-[#d4a574]/15 text-[#d4a574]">
            <Crown className="h-3 w-3" strokeWidth={2.5} />
            {tier}
          </span>
        </div>

        {/* Reward callout */}
        <div className="mt-5 rounded-xl border border-[#d4a574]/20 bg-gradient-to-b from-[#d4a574]/[0.08] to-transparent p-4 text-center">
          <p className="text-xs text-[var(--text-secondary)]">
            Faltam {remaining} cortes para ganhar
          </p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-lg font-bold tracking-tight text-[#d4a574]">
            <Scissors className="h-4 w-4" strokeWidth={2.5} />
            {reward}
          </p>
        </div>

        {/* Stamp progress */}
        <div className="mt-5 flex items-center justify-center gap-2">
          {Array.from({ length: total }).map((_, i) => {
            const filled = i < stamps;
            return (
              <span
                key={i}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${
                  filled
                    ? "bg-gradient-to-b from-[#e0b888] to-[#d4a574] text-[#0b0f17] shadow-[0_2px_6px_rgba(212,165,116,0.35)]"
                    : "border border-white/12 text-[var(--text-tertiary)]"
                }`}
              >
                {filled ? <Scissors className="h-3 w-3" strokeWidth={2.5} /> : i + 1}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs font-medium text-[var(--text-secondary)] tabular-nums">
          {stamps} / {total}
        </p>

        <button className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.03] py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-foreground">
          Ver programa de fidelidade
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </Panel>
  );
}
