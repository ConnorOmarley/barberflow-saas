import { CalendarClock, Plus, MoreHorizontal, ArrowRight } from "lucide-react";
import { todayAgenda } from "@/lib/dashboard/sample-data";
import { Avatar, StatusBadge, Panel, PanelHeader } from "./primitives";

export function TodayAgenda() {
  return (
    <Panel className="flex h-full flex-col">
      <PanelHeader
        title="Agenda de Hoje"
        icon={<CalendarClock className="h-4 w-4" strokeWidth={2} />}
        action={
          <button className="flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[#d4a574]">
            Ver agenda completa
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        }
      />

      <ul className="flex-1 px-3">
        {todayAgenda.map((a) => (
          <li
            key={a.start + a.client}
            className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.03]"
          >
            {/* time column with status rail */}
            <div className="flex items-stretch gap-2.5">
              <span
                className={`w-0.5 rounded-full ${
                  a.status === "done"
                    ? "bg-emerald-400"
                    : a.status === "progress"
                      ? "bg-violet-400"
                      : "bg-[#d4a574]"
                }`}
              />
              <div className="w-12 shrink-0 leading-tight">
                <p className="text-[0.8125rem] font-semibold text-foreground tabular-nums">
                  {a.start}
                </p>
                <p className="text-[0.6875rem] text-[var(--text-tertiary)] tabular-nums">
                  {a.end}
                </p>
              </div>
            </div>

            <Avatar name={a.client} size={36} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{a.client}</p>
              <p className="truncate text-xs text-[var(--text-secondary)]">{a.service}</p>
            </div>

            <StatusBadge status={a.status} />

            <button
              type="button"
              aria-label={`Opções de ${a.client}`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-tertiary)] opacity-0 transition-all hover:bg-white/5 hover:text-foreground group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="p-3">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/12 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[#d4a574]/40 hover:text-[#d4a574]">
          <Plus className="h-4 w-4" />
          Novo agendamento rápido
        </button>
      </div>
    </Panel>
  );
}
