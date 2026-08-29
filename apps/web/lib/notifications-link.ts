/**
 * Cible de navigation d'une notification — déduite du template et de ses variables
 * (contenu_json), côté client comme côté serveur. Une notification cliquée ouvre l'objet
 * concerné (AG, lot, incident…), jamais une page générique quand l'objet est connu.
 */
export function lienNotification(
  templateCode: string,
  contenu: Record<string, unknown> | null | undefined,
  locale: string
): string {
  const c = contenu ?? {};
  const id = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : null);
  const p = (path: string) => `/${locale}${path}`;

  if (templateCode === "PV_DISPONIBLE" && id("ag_id")) return p(`/ag/${id("ag_id")}/pv`);
  if (templateCode.startsWith("AG_") && id("ag_id")) return p(`/ag/${id("ag_id")}`);
  if (templateCode.startsWith("INCIDENT_") && id("incident_id")) {
    return p(`/incidents/${id("incident_id")}`);
  }
  if (
    templateCode === "APPEL_DE_FONDS_EMIS" ||
    templateCode === "PAIEMENT_RECU" ||
    templateCode.startsWith("IMPAYE_")
  ) {
    if (id("lot_id")) return p(`/lots/${id("lot_id")}?onglet=finances`);
    if (id("appel_de_fonds_id")) return p(`/finances/appels-de-fonds/${id("appel_de_fonds_id")}`);
    return p("/finances/appels-de-fonds");
  }
  if (templateCode.startsWith("CONTESTATION_")) return p("/finances/contestations");
  if (templateCode === "LOT_RATTACHE" && id("lot_id")) return p(`/lots/${id("lot_id")}`);
  if (templateCode.startsWith("DOCUMENT_")) return p("/documents");
  if (templateCode === "INVITATION_ACCEPTEE") {
    return id("utilisateur_id") ? p(`/membres/${id("utilisateur_id")}`) : p("/invitations");
  }
  if (templateCode.startsWith("VISITE_")) return p("/visites");
  if (templateCode.startsWith("RESERVATION_")) return p("/reservations");
  if (templateCode.startsWith("LITIGE_")) return p("/litiges");
  return p("/notifications");
}

/** Événement DOM émis quand une notification passe « lue » côté client (cloche, listes). */
export const NOTIF_LUE_EVENT = "su:notif-lue";

export function signalerLue(id: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOTIF_LUE_EVENT, { detail: { id } }));
}

/** Marquage « lu » en arrière-plan (proxy web → API). Ne bloque jamais l'interface. */
export function marquerLueEnFond(id: string): void {
  if (typeof window === "undefined") return;
  signalerLue(id);
  void fetch("/api/notifications-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
    keepalive: true,
  }).catch(() => {
    /* réseau : la prochaine synchronisation rattrapera l'état */
  });
}
