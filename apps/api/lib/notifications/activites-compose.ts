/** États des activités en direct (lib/notifications/activites.ts) — purs, testés sans base. */

// ── Compositions par objet (pures, testées) ──────────────────────────────────

export function etatAgSeance(p: { statut: string; ordre: number | null; nbResolutions: number; nbFinalisees: number; texte?: string | null; nbVotants?: number; resultat?: string | null }): Record<string, string> {
  return {
    statut: p.statut,
    ordre: p.ordre === null ? "" : String(p.ordre),
    nb_resolutions: String(p.nbResolutions),
    nb_finalisees: String(p.nbFinalisees),
    texte: (p.texte ?? "").slice(0, 120),
    nb_votants: String(p.nbVotants ?? 0),
    resultat: p.resultat ?? "",
  };
}

export function etatAppelDeFonds(p: { montantDu: string; montantPaye: string; statut: string; periode: string; echeance: string }): Record<string, string> {
  const du = Number(p.montantDu);
  const paye = Number(p.montantPaye);
  return {
    statut: p.statut,
    montant_du: p.montantDu,
    montant_paye: p.montantPaye,
    reste: (Math.max(0, du - paye)).toFixed(2),
    progression: du > 0 ? Math.min(1, paye / du).toFixed(4) : "1",
    periode: p.periode,
    echeance: p.echeance,
  };
}

export function etatIncident(p: { statut: string; categorie: string; sousCategorie: string; prestataireNom?: string | null; slaDeadline?: Date | null }): Record<string, string> {
  const etapes = ["OUVERT", "EN_COURS", "RESOLU", "FERME"];
  return {
    statut: p.statut,
    etape: String(Math.max(0, etapes.indexOf(p.statut))),
    nb_etapes: "3",
    categorie: p.categorie,
    sous_categorie: p.sousCategorie,
    prestataire: p.prestataireNom ?? "",
    sla: p.slaDeadline ? p.slaDeadline.toISOString() : "",
  };
}
