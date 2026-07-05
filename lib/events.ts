// Gedeelde window-events voor UI-refresh tussen losse componenten.
// Chatpagina stuurt dit na elk voltooid bericht; sidebar en dashboards luisteren.
export const CHATS_UPDATED_EVENT = "chats-updated";
// Idem voor deal-rapporten, na een afgeronde of verwijderde analyse.
export const REPORTS_UPDATED_EVENT = "reports-updated";
// Na wijziging van account-naam/e-mail; de sidebar herlaadt dan /api/auth/me.
export const ACCOUNT_UPDATED_EVENT = "account-updated";
