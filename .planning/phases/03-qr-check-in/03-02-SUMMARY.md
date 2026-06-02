---
phase: "03"
plan: "02"
subsystem: qr-generation
tags: [qr-code, server-action, hmac, public-portal, dashboard]
dependency_graph:
  requires: [03-01]
  provides: [generateQrToken, AppointmentQRCode, /qr/[appointmentId], botão QR dashboard]
  affects: [appointment-status-actions.tsx]
key_files:
  created:
    - src/app/actions/qr-checkin.ts
    - src/components/qr/appointment-qr-code.tsx
    - src/app/(public)/qr/[appointmentId]/page.tsx
  modified:
    - src/app/(owner)/dashboard/agendamentos/components/appointment-status-actions.tsx
decisions:
  - "react-qr-code v2 usado para SVG client-side sem hidratação"
  - "generateQrToken usa adminClient (sem JWT do caller público)"
  - "Botão QR Check-In abre modal inline — sem rota separada no dashboard"
  - "Permalink /qr/[appointmentId] para owner compartilhar com cliente"
metrics:
  completed: "2026-06-02"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 03 Plan 02: QR Display — Summary

**One-liner:** `generateQrToken` Server Action + `AppointmentQRCode` SVG + permalink `/qr/[appointmentId]` + botão "QR Check-In" com modal no dashboard para agendamentos CONFIRMED.

## Tasks Completed

| Task | Nome | Arquivos |
|------|------|---------|
| 1 | generateQrToken + install react-qr-code | src/app/actions/qr-checkin.ts |
| 2 | AppointmentQRCode + permalink + botão dashboard | src/components/qr/, src/app/(public)/qr/[appointmentId]/, appointment-status-actions.tsx |

## Self-Check: PASSED

- [x] `react-qr-code` instalado
- [x] `generateQrToken` exportado de qr-checkin.ts
- [x] `AppointmentQRCode` criado como 'use client' com QRCode SVG
- [x] `/qr/[appointmentId]/page.tsx` criado como Server Component público
- [x] Botão "QR Check-In" visível para CONFIRMED em appointment-status-actions
- [x] Modal overlay com QR exibido inline
- [x] Zero erros TypeScript
