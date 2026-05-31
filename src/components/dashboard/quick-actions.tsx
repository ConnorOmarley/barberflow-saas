import {
  CalendarPlus,
  UserPlus,
  DollarSign,
  Scissors,
  MessageCircle,
  BarChart3,
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
      <h2 className="mb-4 text-[0.9375rem] font-semibold text-foreground">
        Ações Rápidas
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {ACTIONS.map(({ label, Icon, fg }) => (
          <button
            key={label}
            className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-4 text-center transition-all hover:border-white/12 hover:bg-white/[0.05]"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${fg}1f`, color: fg }}
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
