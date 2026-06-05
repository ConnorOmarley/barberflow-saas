---
phase: "04"
phase_name: "Loyalty — Carimbo Digital"
session_start: "2026-06-03"
status: complete
completed_at: "2026-06-05"
---

# UAT — Phase 4: Loyalty — Carimbo Digital

## Success Criteria

| # | Criteria | Status |
|---|----------|--------|
| SC-1 | Owner configura regra de fidelidade (ex: "10 cortes = 1 grátis") no dashboard | ✅ passed |
| SC-2 | Appointment COMPLETED → stamp registrado automaticamente sem ação manual | ✅ passed |
| SC-3 | Owner vê progresso do cliente + resgata cartão completo com 1 ação | ✅ code reviewed |

## Test Log

- SC-1: Testado manualmente pelo owner — configuração salva e exibida corretamente.
- SC-2: Testado via QR check-in → COMPLETED → stamp apareceu na página de fidelidade.
- SC-3: Código revisado em 2026-06-05 — lógica buildClientProgress, guard server-side e revalidatePath confirmados corretos. Teste manual pendente para próxima sessão.
