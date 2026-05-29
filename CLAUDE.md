# BarberFlow — Project Guide

## Project

SaaS multi-tenant de agendamento e gestão para barbearias. Stack: Next.js 15 + Supabase + Asaas + WhatsApp Cloud API.

See `.planning/PROJECT.md` for full context.

## GSD Workflow

This project uses the GSD (Get Shit Done) workflow. All planning artifacts live in `.planning/`.

### Phase Commands

```
/gsd:discuss-phase N     — Discuss approach before planning
/gsd:plan-phase N        — Plan a phase (spawns researcher + planner)
/gsd:execute-phase N     — Execute a planned phase
/gsd:verify-work N       — Verify phase deliverables
/gsd:progress            — Current project state
```

### Current State

See `.planning/STATE.md` for current phase and progress.

### Roadmap

9 phases — see `.planning/ROADMAP.md`:

- Phase 0: Infrastructure & Multi-Tenancy Baseline ← **START HERE**
- Phase 1: Owner Onboarding + Barber & Service Setup
- Phase 2: Client Booking Portal
- Phase 3: QR Check-In
- Phase 4: Loyalty — Carimbo Digital
- Phase 5: WhatsApp Notifications
- Phase 6: SaaS Billing (Asaas)
- Phase 7: Financial Reports & Dashboard
- Phase 8: White Label Basics

## Critical Constraints

### Multi-Tenancy (non-negotiable)
- Every table has `barbershop_id UUID NOT NULL` with RLS enabled
- RLS policies read from JWT `app_metadata.barbershop_id` — never application-layer filtering as primary gate
- CI must assert zero tables with `rowsecurity = false`
- Cannot be retrofitted — Phase 0 establishes this permanently

### Scheduling
- Slot blocking uses PostgreSQL exclusion constraint with GIST index on `tsrange(start_time, end_time)`
- Duration must be respected: `end_time = start_time + service_duration`
- All times stored as `TIMESTAMPTZ` (UTC) — display converted using `barbershop.timezone`

### WhatsApp (LGPD)
- Never send messages without `whatsapp_opt_in = true`
- Store `opt_in_timestamp` and `opt_in_source` at client registration
- Submit Meta message templates **2 weeks before Phase 5** — treat as a blocking dependency

### Payments
- Asaas handles both SaaS billing (subscriptions) and appointment pre-payment (PIX)
- All Asaas webhooks must be idempotent — write to `webhook_events` first, return 200, process async
- PIX QR codes expire in ~30 minutes — implement auto-cancel cron

### QR Check-In
- QR tokens are HMAC-signed with `appointment_id + issued_at + expires_at`
- Valid window: ±30 minutes from appointment time
- Single-use: mark consumed in `used_qr_tokens`
- Revoke on cancellation or reschedule

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Database | Supabase (Postgres + RLS) |
| Auth | Supabase Auth + custom JWT claims |
| Storage | Supabase Storage |
| Background jobs | Supabase Edge Functions + pg_cron |
| Realtime | Supabase Realtime (Broadcast channels) |
| SaaS Billing | Asaas REST API |
| Payments | Asaas (PIX, boleto) |
| Notifications | WhatsApp Business Cloud API (Meta) |
| QR codes | qrcode + react-qr-code + html5-qrcode |
| Styling | Tailwind CSS + shadcn/ui |
| Forms | React Hook Form + Zod |

## Do NOT Use

Prisma, Stripe, Firebase, Auth.js, NextAuth, Moment.js, separate Supabase projects per tenant.
