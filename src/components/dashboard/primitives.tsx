import type { AppointmentStatus } from "@/lib/dashboard/sample-data";

/** Deterministic jewel-tone gradients — premium on dark, harmonise with gold. */
const AVATAR_GRADIENTS: [string, string][] = [
  ["#3f5278", "#27314d"], // indigo slate
  ["#4a3d72", "#2c264c"], // violet
  ["#3a6b59", "#23463a"], // emerald
  ["#6b4a39", "#46301f"], // copper
  ["#6b3b4d", "#46232f"], // rose
  ["#3a5d6b", "#234049"], // teal slate
  ["#5a5a3a", "#3d3d23"], // olive gold
  ["#4a4f5e", "#2c303b"], // graphite
];

/** Initials avatar — deterministic gradient + quiet ring, no photo dependency. */
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

  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const [from, to] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ring-1 ring-white/10"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
      }}
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
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d4a574]/10 text-[#d4a574] ring-1 ring-inset ring-[#d4a574]/15">
            {icon}
          </span>
        )}
        <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
