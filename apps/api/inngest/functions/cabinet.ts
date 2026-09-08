/** Job Cabinet (M25) — KPI du portefeuille rafraîchis toutes les 15 minutes (vue matérialisée, tableau de bord instantané). */
import { inngest } from "../client";
import { rafraichirPortefeuilleKpi } from "../../lib/cabinet/jobs";

export const portefeuilleKpiRefresh = inngest.createFunction(
  { id: "portefeuille-kpi-refresh", triggers: [{ cron: "*/15 * * * *" }] },
  async () => rafraichirPortefeuilleKpi()
);
