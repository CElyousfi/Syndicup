/**
 * Checklist de démarrage d'une résidence (M24, Doc A §11) — calculée depuis les données, jamais
 * stockée : résidence créée → lots importés → tantièmes cohérents → propriétaires invités →
 * % acceptés → budget actif → premier appel envoyé → RIB saisi → assurance saisie → gardien créé.
 * Disparaît des écrans quand tout est fait.
 */
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { money } from "../money";

export class PermissionRefuseeError extends Error {}
export type EtapeOnboarding = { cle: string; fait: boolean; valeur?: string | number | null; detail?: string | null; lien: string };

export async function checklistOnboarding(ctx: TenantContext) {
  if (can("onboarding.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const id = ctx.coproprieteId;
    const [copro, lots, invitations, acceptees, proprietairesActifs, budgetActif, premierAppel, assurance, gardiens, imports] = await Promise.all([
      db.copropriete.findUnique({ where: { id }, select: { nom: true, nbLots: true, totalTantiemes: true, comptesBancairesJson: true, creeLe: true, estDemo: true } }),
      db.lot.findMany({ where: { coproprieteId: id }, select: { tantiemes: true } }),
      db.invitation.count({ where: { coproprieteId: id, roleCible: { in: ["PROPRIETAIRE", "INDIVISAIRE", "PERSONNE_MORALE_REPRESENTANT", "LOCATAIRE"] }, statut: { in: ["EN_ATTENTE", "ACCEPTEE"] } } }),
      db.invitation.count({ where: { coproprieteId: id, roleCible: { in: ["PROPRIETAIRE", "INDIVISAIRE", "PERSONNE_MORALE_REPRESENTANT", "LOCATAIRE"] }, statut: "ACCEPTEE" } }),
      db.roleUtilisateur.count({ where: { coproprieteId: id, actif: true, role: { in: ["PROPRIETAIRE", "INDIVISAIRE", "PERSONNE_MORALE_REPRESENTANT"] } } }),
      db.budgetAg.count({ where: { coproprieteId: id, statut: "ACTIF" } }),
      db.appelDeFonds.count({ where: { coproprieteId: id, statut: { in: ["EMIS", "CLOTURE"] }, type: { not: "SOLDE_OUVERTURE" } } }),
      db.contrat.count({ where: { coproprieteId: id, type: "ASSURANCE_IMMEUBLE", statut: "ACTIF" } }),
      db.personnel.count({ where: { coproprieteId: id } }),
      db.importJob.count({ where: { coproprieteId: id, statut: "TERMINE" } }),
    ]);
    const somme = lots.reduce((acc, l) => acc.plus(money(l.tantiemes.toString())), money(0));
    const total = copro?.totalTantiemes ? money(copro.totalTantiemes.toString()) : null;
    const comptes = Array.isArray(copro?.comptesBancairesJson) ? (copro!.comptesBancairesJson as unknown[]).length : 0;
    const invites = invitations + proprietairesActifs;
    const tauxAccept = invites > 0 ? Math.round(((acceptees + proprietairesActifs) / invites) * 100) : 0;
    const etapes: EtapeOnboarding[] = [
      { cle: "residence_creee", fait: true, valeur: copro?.nom ?? null, lien: "/parametres" },
      { cle: "lots_importes", fait: lots.length > 0, valeur: lots.length, detail: copro ? `${lots.length}/${copro.nbLots}` : null, lien: "/import" },
      { cle: "tantiemes_coherents", fait: lots.length > 0 && (total ? somme.equals(total) : somme.greaterThan(0)), valeur: somme.toFixed(2), detail: total ? `${somme.toFixed(2)} / ${total.toFixed(2)}` : "total du règlement non renseigné", lien: total ? "/lots" : "/parametres" },
      { cle: "proprietaires_invites", fait: invites > 0, valeur: invites, lien: "/invitations" },
      { cle: "acceptes", fait: invites > 0 && tauxAccept >= 50, valeur: tauxAccept, detail: `${acceptees + proprietairesActifs}/${invites}`, lien: "/invitations" },
      { cle: "budget_actif", fait: budgetActif > 0, valeur: budgetActif, lien: "/finances/budgets" },
      { cle: "premier_appel", fait: premierAppel > 0, valeur: premierAppel, lien: "/finances/appels-de-fonds" },
      { cle: "rib_saisi", fait: comptes > 0, valeur: comptes, lien: "/parametres" },
      { cle: "assurance_saisie", fait: assurance > 0, valeur: assurance, lien: "/contrats" },
      { cle: "gardien_cree", fait: gardiens > 0, valeur: gardiens, lien: "/personnel" },
    ];
    const faites = etapes.filter((e) => e.fait).length;
    return { copropriete_id: id, est_demo: copro?.estDemo ?? false, etapes, faites, total: etapes.length, complet: faites === etapes.length, imports_termines: imports, progression: Math.round((faites / etapes.length) * 100) };
  });
}
