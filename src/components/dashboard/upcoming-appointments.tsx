import { ArrowRight } from "lucide-react";
import { upcoming } from "@/lib/dashboard/sample-data";
import { Avatar, StatusDot, Panel, PanelHeader } from "./primitives";

export function UpcomingAppointments() {
  return (
    <Panel className="flex h-full flex-col">
      <PanelHeader title="Próximos Agendamentos" />

      <ul className="flex-1 px-3">
        {upcoming.map((u) => (
          <li
            key={u.time + u.client}
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.03]"
          >
            <span className="w-11 shrink-0 text-[0.8125rem] font-semibold text-foreground tabular-nums">
              {u.time}
            </span>
            <Avatar name={u.client} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{u.client}</p>
              <p className="truncate text-xs text-[var(--text-secondary)]">{u.service}</p>
            </div>
            <StatusDot status={u.status} />
          </li>
        ))}
      </ul>

      <div className="p-3">
        <button className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.03] py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-foreground">
          Ver todos agendamentos
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </Panel>
  );
}
