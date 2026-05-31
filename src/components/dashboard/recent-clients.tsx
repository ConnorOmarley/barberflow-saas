import { ArrowRight, MoreVertical } from "lucide-react";
import { recentClients, brl } from "@/lib/dashboard/sample-data";
import { Avatar, Panel, PanelHeader } from "./primitives";

export function RecentClients() {
  return (
    <Panel className="flex h-full flex-col">
      <PanelHeader
        title="Clientes Recentes"
        action={
          <button className="flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[#d4a574]">
            Ver todos
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        }
      />

      <ul className="flex-1 px-3 pb-3">
        {recentClients.map((c) => (
          <li
            key={c.name}
            className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.03]"
          >
            <Avatar name={c.name} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
              <p className="truncate text-xs text-[var(--text-secondary)]">
                Último corte: {c.lastVisit}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[0.6875rem] text-[var(--text-tertiary)]">Total gasto</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">
                {brl(c.total)}
              </p>
            </div>
            <button className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-tertiary)] opacity-0 transition-all hover:bg-white/5 hover:text-foreground group-hover:opacity-100">
              <MoreVertical className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
