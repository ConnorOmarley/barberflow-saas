import type { AppointmentStatus } from "@/lib/dashboard/sample-data";

/** Initials avatar — quiet gradient ring, no photo dependency. */
export function Avatar({
  name,
  size = 40,
}: {
  name: string;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-[#1f2530] font-semibold text-[#cbd5e1] ring-1 ring-white/10"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  done: "Concluído",
  scheduled: "Agendado",
  progress: "Em andamento",
};

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  done: "badge-done",
  scheduled: "badge-scheduled",
  progress: "badge-progress",
};

const STATUS_DOT: Record<AppointmentStatus, string> = {
  done: "bg-emerald-400",
  scheduled: "bg-[#d4a574]",
  progress: "bg-violet-400",
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`badge-pill ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function StatusDot({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[status]}`}
      aria-hidden
    />
  );
}

/** Card wrapper with the locked surface treatment. */
export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-card ${className}`}>{children}</section>
  );
}

export function PanelHeader({
  title,
  icon,
  action,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-[#d4a574]">{icon}</span>}
        <h2 className="text-[0.9375rem] font-semibold text-foreground">{title}</h2>
      </div>
      {action}
    </div>
  );
}
