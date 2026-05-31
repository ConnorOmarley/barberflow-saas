/**
 * PLACEHOLDER DASHBOARD DATA — Phase 0 visual scaffold.
 *
 * The appointments/clients/services tables are empty until Phases 1–7 populate
 * them. These typed fixtures let the dashboard render at full fidelity now;
 * each export is swapped for a real Supabase query as its phase ships:
 *   - kpis / weeklyRevenue / commission → Phase 7 (Financial Reports)
 *   - todayAgenda / upcoming           → Phase 2 (Booking) + Phase 1 (manual)
 *   - recentClients                    → Phase 1/2
 *   - loyaltyHighlight                 → Phase 4 (Carimbo Digital)
 */

export type AppointmentStatus = "done" | "scheduled" | "progress";

export type AgendaEntry = {
  start: string;
  end: string;
  client: string;
  service: string;
  status: AppointmentStatus;
};

export type UpcomingEntry = {
  time: string;
  client: string;
  service: string;
  status: AppointmentStatus;
};

export type ClientRow = {
  name: string;
  lastVisit: string;
  total: number;
};

export const kpis = [
  { key: "receita", label: "Receita Hoje", value: "R$ 4.230,00", delta: 18, icon: "revenue" },
  { key: "cortes", label: "Cortes Hoje", value: "112", delta: 12, icon: "cut" },
  { key: "clientes", label: "Novos Clientes", value: "18", delta: 8, icon: "clients" },
  { key: "comissao", label: "Comissão Hoje", value: "R$ 980,00", delta: 15, icon: "commission" },
] as const;

export const todayAgenda: AgendaEntry[] = [
  { start: "09:00", end: "09:45", client: "Lucas Andrade", service: "Corte + Barba", status: "done" },
  { start: "10:00", end: "10:45", client: "Rafael Souza", service: "Corte Degradê", status: "progress" },
  { start: "11:00", end: "11:45", client: "André Martins", service: "Corte + Sobrancelha", status: "progress" },
  { start: "13:30", end: "14:15", client: "Carlos Eduardo", service: "Barba + Pigmentação", status: "scheduled" },
  { start: "14:30", end: "15:15", client: "Pedro Henrique", service: "Corte Social", status: "scheduled" },
];

export const weeklyRevenue = {
  total: "R$ 18.750,00",
  delta: 16,
  // value per weekday (Seg → Dom), in thousands of BRL
  points: [2.1, 3.6, 2.9, 4.0, 5.0, 4.5, 3.2],
  peakLabel: "R$ 4.230",
  peakIndex: 4,
  days: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
};

export const upcoming: UpcomingEntry[] = [
  { time: "14:30", client: "Carlos Lima", service: "Corte + Barba", status: "scheduled" },
  { time: "15:00", client: "Gabriel Pereira", service: "Corte Degradê", status: "scheduled" },
  { time: "15:30", client: "Matheus Alves", service: "Corte + Sobrancelha", status: "scheduled" },
  { time: "16:00", client: "Bruno Ferreira", service: "Corte Social", status: "progress" },
  { time: "16:30", client: "Diego Santos", service: "Pigmentação", status: "progress" },
];

export const recentClients: ClientRow[] = [
  { name: "Lucas Andrade", lastVisit: "12 dias atrás", total: 320 },
  { name: "Rafael Souza", lastVisit: "7 dias atrás", total: 450 },
  { name: "André Martins", lastVisit: "15 dias atrás", total: 280 },
  { name: "Bruno Ferreira", lastVisit: "3 dias atrás", total: 620 },
];

export const loyaltyHighlight = {
  client: "Lucas Andrade",
  tier: "Ouro",
  stamps: 7,
  total: 10,
  reward: "1 CORTE GRÁTIS",
};

export function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
