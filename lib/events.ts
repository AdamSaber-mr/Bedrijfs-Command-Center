// Gedeelde window-events voor UI-refresh tussen losse componenten.
// Chatpagina stuurt dit na elk voltooid bericht; sidebar en dashboards luisteren.
export const CHATS_UPDATED_EVENT = "chats-updated";
// Idem voor deal-rapporten, na een afgeronde of verwijderde analyse.
export const REPORTS_UPDATED_EVENT = "reports-updated";
