import { TrendingUp, BarChart3, ChevronDown } from "lucide-react";
import { weeklyRevenue } from "@/lib/dashboard/sample-data";
import { Panel } from "./primitives";

const W = 720;
const H = 240;
const PAD_L = 36;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 28;
const Y_MAX = 5.5; // thousands

function x(i: number, n: number) {
  return PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R);
}
function y(v: number) {
  return PAD_T + (1 - v / Y_MAX) * (H - PAD_T - PAD_B);
}

export function RevenueChart() {
  const { points, days, total, delta, peakIndex, peakLabel } = weeklyRevenue;
  const n = points.length;

  const line = points.map((v, i) => `${x(i, n)},${y(v)}`).join(" ");
  const area =
    `${PAD_L},${y(0)} ` +
    points.map((v, i) => `${x(i, n)},${y(v)}`).join(" ") +
    ` ${x(n - 1, n)},${y(0)}`;

  const yTicks = [0, 1, 2, 3, 4, 5];

  return (
    <Panel className="flex h-full flex-col">
      <div className="flex items-start justify-between px-5 pt-5">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#d4a574]" strokeWidth={2} />
            <h2 className="text-[0.9375rem] font-semibold text-foreground">
              Receita da Semana
            </h2>
          </div>
          <p className="mt-3 text-[1.875rem] font-bold leading-none tracking-tight text-foreground tabular-nums">
            {total}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.5} />
            <span className="font-semibold text-emerald-400 tabular-nums">{delta}%</span>
            <span className="text-[var(--text-tertiary)]">vs semana passada</span>
          </div>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-foreground">
          Esta semana
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 flex-1 px-2 pb-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="Gráfico de receita da semana"
        >
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4a574" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#d4a574" stopOpacity="0" />
            </linearGradient>
            <filter id="revGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* horizontal grid + y labels */}
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y(t)}
                y2={y(t)}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
              <text
                x={PAD_L - 8}
                y={y(t) + 3}
                textAnchor="end"
                className="fill-[#64748b]"
                style={{ fontSize: 10 }}
              >
                {t === 0 ? "0" : `${t}k`}
              </text>
            </g>
          ))}

          {/* area + line */}
          <polygon points={area} fill="url(#revFill)" />
          <polyline
            points={line}
            fill="none"
            stroke="#d4a574"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#revGlow)"
          />

          {/* peak marker + tooltip */}
          <circle cx={x(peakIndex, n)} cy={y(points[peakIndex])} r="4.5" fill="#d4a574" />
          <circle
            cx={x(peakIndex, n)}
            cy={y(points[peakIndex])}
            r="8"
            fill="#d4a574"
            fillOpacity="0.18"
          />
          <g transform={`translate(${x(peakIndex, n)}, ${y(points[peakIndex]) - 30})`}>
            <rect x="-32" y="-13" width="64" height="22" rx="6" fill="#d4a574" />
            <text textAnchor="middle" y="2" className="fill-[#0b0f17]" style={{ fontSize: 11, fontWeight: 700 }}>
              {peakLabel}
            </text>
          </g>

          {/* x labels */}
          {days.map((d, i) => (
            <text
              key={d}
              x={x(i, n)}
              y={H - 8}
              textAnchor="middle"
              className="fill-[#64748b]"
              style={{ fontSize: 10 }}
            >
              {d}
            </text>
          ))}
        </svg>
      </div>
    </Panel>
  );
}
