# BarberFlow — Interface Design System

> Locked visual reference: **premium operational SaaS** (Linear / Stripe / Vercel).
> Dark navy canvas, soft gold accent. Inter typography. Compact-but-breathable density.
> This file is the source of truth — reuse these patterns, don't reinvent.

## Direction & Feel

Funded premium SaaS for barbershop owners. Dark, clean, compact, professional.
Gold is the single brand accent — used sparingly (logo, active nav, key values, CTAs,
loyalty). Status semantics: emerald = done/positive, gold = scheduled, violet = in-progress.

## Depth Strategy

**Layered (subtle).** Surfaces use `.surface-card`: navy fill + faint top sheen gradient
+ soft layered shadow + inset top highlight. Borders are whisper-quiet
(`rgba(255,255,255,0.07)`), brighten to `0.12` on hover. Never harsh lines.

## Color Tokens (globals.css `:root, .dark`)

| Token | Value | Use |
|-------|-------|-----|
| `--background` | `#0b0f17` | page canvas |
| `--sidebar-bg` | `#0f131c` | sidebar (border-separated, not a different world) |
| `--surface` | `#151922` | cards |
| `--surface-raised` | `#1a1f2a` | inputs, raised |
| `--foreground` | `#f3f4f6` | primary text |
| `--text-secondary` | `#94a3b8` | secondary |
| `--text-tertiary` | `#64748b` | metadata/muted |
| `--gold` / `--primary` | `#d4a574` | brand accent |
| `--emerald` | `#10b981` | success/done |
| `--purple` | `#8b5cf6` | in-progress |
| `--border` | `rgba(255,255,255,0.07)` | hairlines |
| `--radius` | `1rem` | cards (16px); inputs/buttons use radius-md ≈12px |

## Typography

- **Font:** Inter (weights 400/500/600/700/800), `--font-inter`.
- Global `letter-spacing: -0.011em`, features `cv11 ss01 calt liga`, antialiased.
- **KPI metric:** 34px / 800 / `-0.035em` tabular-nums — must dominate its card.
- **Greeting / page H1:** 28px / 700 / `-0.03em`.
- **Panel title:** 15px / 600 / `-0.01em`.
- **Label/secondary:** 12–13px / 500 / `--text-secondary`.
- Numbers/money/time always `tabular-nums`.

## Spacing

8px base. Grid + column gaps `16px` (`gap-4`). Card padding `20px` (`p-5`),
header `px-5 pt-5 pb-4`. List rows `py-2.5`, rounded `xl`, hover `bg-white/[0.03]`.

## Icon System (premium)

- **KPI / quick-action badges:** rounded square, `linear-gradient(135deg, ${c}26, ${c}0d)`
  fill, `1px ${c}2e` ring, `inset 0 1px 0 ${c}30, 0 6px 16px -6px ${c}66` glow. Brighter glyph.
- **Sidebar:** fixed `.nav-ico` slot (1.75rem) keeps labels aligned. Active = gold gradient
  icon badge + ring + glow, glowing gold left indicator bar, gold-tinted pill, near-white label.
  Inactive icons at tertiary weight, brighten on hover.
- **Section headers:** leading icon in subtle gold-tinted rounded container (`bg-[#d4a574]/10`
  + `ring-1 ring-inset ring-[#d4a574]/15`).
- Lucide icons only, strokeWidth 2 (2.25 for KPI glyphs).

## Key Components

- **`.surface-card`** — the one card treatment. All panels use `<Panel>` / `surface-card`.
- **`<Panel>` / `<PanelHeader>`** (`components/dashboard/primitives.tsx`) — title + gold icon
  container + optional action (right-aligned "Ver todos" link).
- **`<Avatar>`** — initials on deterministic jewel-tone gradient (8-stop palette hashed by
  name) + inset highlight + ring. No photo dependency.
- **`StatusBadge` / `StatusDot`** — done/scheduled/progress via `.badge-done/.badge-scheduled/
  .badge-progress`.
- **`<DashboardShell role>`** (`components/shell/`) — role-aware sidebar (gold "B" logo +
  BARBERFLOW/PROFESSIONAL, MENU eyebrow, nav, owner plan card, user footer w/ sign out).
- **`RevenueChart`** — custom inline SVG area chart: gold line + glow, gradient fill,
  gold-ringed dot per point, peak tooltip. No charting lib.

## Data Note

Dashboard fixtures live in `src/lib/dashboard/sample-data.ts` — typed PLACEHOLDERS for the
Phase 0 visual scaffold. Swap each export for a real Supabase query as its phase ships
(KPIs/revenue → Phase 7, agenda → Phase 2, loyalty → Phase 4).

## Hover / Motion

Fast (0.15s) color/bg transitions, deceleration easing. Cards brighten border on hover;
quick-action icons scale 1.05. Entrance via `.rise-in` (riseIn keyframe). No spring/bounce.
