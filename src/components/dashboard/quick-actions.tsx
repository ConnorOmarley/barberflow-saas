import {
  CalendarPlus,
  UserPlus,
  DollarSign,
  Scissors,
  MessageCircle,
  BarChart3,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "./primitives";

const ACTIONS: { label: string; Icon: LucideIcon; fg: string }[] = [
  { label: "Novo Agendamento", Icon: CalendarPlus, fg: "#d4a574" },
  { label: "Adicionar Cliente", Icon: UserPlus, fg: "#60a5fa" },
  { label: "Venda Rápida", Icon: DollarSign, fg: "#34d399" },
  { label: "Novo Serviço", Icon: Scissors, fg: "#a78bfa" },
  { label: "Enviar WhatsApp", Icon: MessageCircle, fg: "#34d399" },
  { label: "Ver Relatórios", Icon: BarChart3, fg: "#d4a574" },
];

export function QuickActions() {
  return (
    <Panel className="p-5">
      <h2 className="mb-4 flex items-center gap-2.5 text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d4a574]/10 text-[#d4a574] ring-1 ring-inset ring-[#d4a574]/15">
          <Zap className="h-4 w-4" strokeWidth={2} />
        </span>
        Ações Rápidas
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {ACTIONS.map(({ label, Icon, fg }) => (
          <button
            type="button"
            key={label}
            className="group flex flex-col items-center justify-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-4 text-center transition-all hover:border-white/12 hover:bg-white/[0.05]"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
              style={{
                color: fg,
                backgroundImage: `linear-gradient(135deg, ${fg}26, ${fg}0d)`,
                border: `1px solid ${fg}2e`,
                boxShadow: `inset 0 1px 0 0 ${fg}30, 0 4px 12px -5px ${fg}66`,
              }}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <span className="text-[0.6875rem] font-medium leading-tight text-[var(--text-secondary)]">
              {label}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}
