/**
 * Moteur d'escalade des impayés — M5 (Doc A §3.3, Master Spec Partie 6.3).
 *
 * Doc A §3.3 (6 niveaux, délais J+3…J+90) l'emporte sur le Master Spec Partie 6.3 (4 niveaux) —
 * conflit tranché en faveur de Doc A (métier), déjà signalé sur l'enum `NiveauEscalade` du
 * schéma Prisma. Les délais par défaut ci-dessous sont surchargeable par copropriété via
 * `copropriete.politique_recouvrement_json` (Master Spec Partie 6.3 : "les délais exacts doivent
 * être calés sur la politique de recouvrement propre à chaque copropriété").
 *
 * Point d'entrée : `executerEscaladeImpayes(coproprieteId)` — conçu pour être appelé par un job
 * cron quotidien (Inngest, non encore câblé dans ce repo — apps/api/inngest/ n'est qu'un README,
 * voir ROADMAP_BACKLOG.md). Acteur système : contexte SUPER_ADMIN + acteur_id null dans
 * l'audit_log, même convention que le webhook CMI (finances.ts::traiterWebhookCmi).
 *
 * Ce qui est automatique ici (colonne "Action automatique" du tableau Doc A §3.3) :
 *   - avancement du niveau + horodatage (jamais deux notifications pour le même palier —
 *     c'est la raison d'être de `niveau_escalade`/`derniere_escalade_le`)
 *   - notification au(x) copropriétaire(s) du lot à chaque palier atteint
 *   - notification au syndic à partir de N4 (plan d'apurement à négocier, décision de
 *     suspension N5, dossier tribunal N6 — colonnes "Action manuelle syndic")
 * Ce qui est DIFFÉRÉ (module Documents/M9 incomplet — voir ROADMAP_BACKLOG.md) : la génération
 * des PDF (relance formelle N2, mise en demeure N3, dossier injonction N6) et l'échéancier de
 * plan d'apurement N4 (aucune table dédiée dans le schéma Master Spec — à modéliser si demandé).
 */
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import type { NiveauEscalade } from "@prisma/client";

/** Délais par défaut en jours après `appel_de_fonds.date_echeance` (Doc A §3.3, tableau). */
export const DELAIS_ESCALADE_DEFAUT: Record<Exclude<NiveauEscalade, "N0">, number> = {
  N1: 3, // Rappel simple — push + email automatique
  N2: 15, // Relance formelle
  N3: 30, // Mise en demeure
  N4: 45, // Plan d'apurement
  N5: 60, // Suspension services (si légal — décision syndic, jamais eau/électricité)
  N6: 90, // Injonction à payer (Art. 39 Loi 18-00)
};

const NIVEAUX_ORDONNES: Exclude<NiveauEscalade, "N0">[] = ["N1", "N2", "N3", "N4", "N5", "N6"];

const ORDRE: Record<NiveauEscalade, number> = { N0: 0, N1: 1, N2: 2, N3: 3, N4: 4, N5: 5, N6: 6 };

export interface ResultatEscalade {
  lignesExaminees: number;
  escalades: { appelDeFondsLotId: string; de: NiveauEscalade; vers: NiveauEscalade }[];
}

/**
 * Fusionne les délais par défaut avec la surcharge éventuelle de la copropriété
 * (`politique_recouvrement_json`, forme attendue : `{ "N1": 5, "N3": 40, ... }` — clés
 * partielles autorisées, valeurs en jours). Toute valeur non numérique ou négative est ignorée
 * (jamais de défaut silencieux MODIFIÉ : on retombe sur Doc A §3.3, et la politique malformée
 * reste visible dans copropriete.politique_recouvrement_json pour correction).
 */
export function delaisEffectifs(
  politiqueRecouvrementJson: unknown
): Record<Exclude<NiveauEscalade, "N0">, number> {
  const delais = { ...DELAIS_ESCALADE_DEFAUT };
  if (politiqueRecouvrementJson && typeof politiqueRecouvrementJson === "object") {
    for (const niveau of NIVEAUX_ORDONNES) {
      const valeur = (politiqueRecouvrementJson as Record<string, unknown>)[niveau];
      if (typeof valeur === "number" && Number.isFinite(valeur) && valeur >= 0) {
        delais[niveau] = valeur;
      }
    }
  }
  return delais;
}

/** Niveau cible pour un retard donné : le plus haut palier dont le délai est atteint. */
export function niveauCible(
  joursRetard: number,
  delais: Record<Exclude<NiveauEscalade, "N0">, number>
): NiveauEscalade {
  let cible: NiveauEscalade = "N0";
  for (const niveau of NIVEAUX_ORDONNES) {
    if (joursRetard >= delais[niveau]) cible = niveau;
  }
  return cible;
}

/**
 * Passe d'escalade pour UNE copropriété — idempotente : réexécuter le même jour ne renotifie
 * rien (le niveau stocké a déjà rattrapé le niveau cible). Si le job a raté plusieurs jours,
 * la ligne saute directement au niveau cible avec UNE notification (celle du palier atteint),
 * pas une par palier intermédiaire — décision explicite : rejouer N1+N2+N3 d'un coup serait
 * du spam sans valeur légale ajoutée (la mise en demeure N3 englobe les relances précédentes).
 */
export async function executerEscaladeImpayes(coproprieteId: string): Promise<ResultatEscalade> {
  const ctxSysteme: TenantContext = {
    utilisateurId: "00000000-0000-0000-0000-000000000000",
    coproprieteId,
    role: "SUPER_ADMIN",
  };

  return withTenant(ctxSysteme, async (db) => {
    const copropriete = await db.copropriete.findUnique({
      where: { id: coproprieteId },
      select: { politiqueRecouvrementJson: true },
    });
    if (!copropriete) return { lignesExaminees: 0, escalades: [] };
    const delais = delaisEffectifs(copropriete.politiqueRecouvrementJson);

    // Lignes en souffrance : IMPAYE/PARTIEL, échéance passée. Les lignes contestées sont
    // exclues — Doc A §3.3 "Cas Particuliers" donne un droit de contestation formel : escalader
    // pendant l'instruction de la contestation exposerait le syndic à une mise en demeure
    // abusive. L'escalade reprend quand le flag `conteste` est levé (réponse du syndic).
    const lignes = await db.appelDeFondsLot.findMany({
      where: {
        statut: { in: ["IMPAYE", "PARTIEL"] },
        conteste: false,
        appelDeFonds: { coproprieteId, dateEcheance: { lt: new Date() } },
      },
      select: {
        id: true,
        lotId: true,
        niveauEscalade: true,
        montantDu: true,
        montantPaye: true,
        appelDeFonds: { select: { id: true, periode: true, dateEcheance: true } },
      },
    });

    const maintenant = Date.now();
    const escalades: ResultatEscalade["escalades"] = [];

    for (const ligne of lignes) {
      const joursRetard = Math.floor(
        (maintenant - ligne.appelDeFonds.dateEcheance.getTime()) / (24 * 60 * 60 * 1000)
      );
      const cible = niveauCible(joursRetard, delais);
      if (ORDRE[cible] <= ORDRE[ligne.niveauEscalade]) continue;

      await db.appelDeFondsLot.update({
        where: { id: ligne.id },
        data: { niveauEscalade: cible, derniereEscaladeLe: new Date() },
      });

      await notifierEscalade(db, coproprieteId, ligne, cible);

      await ecrireAuditLog(db, {
        coproprieteId,
        acteurId: null,
        action: "IMPAYE_ESCALADE",
        entite: "appel_de_fonds_lot",
        entiteId: ligne.id,
        avant: { niveau_escalade: ligne.niveauEscalade },
        apres: { niveau_escalade: cible, jours_retard: joursRetard },
      });

      escalades.push({ appelDeFondsLotId: ligne.id, de: ligne.niveauEscalade, vers: cible });
    }

    return { lignesExaminees: lignes.length, escalades };
  });
}

/**
 * Scaffold du job cron global (à brancher sur Inngest quand l'infra existera) : itère toutes
 * les copropriétés. Chaque copropriété est traitée dans sa propre transaction tenant — l'échec
 * de l'une n'empêche pas les autres.
 */
export async function executerEscaladeImpayesToutesCoproprietes(): Promise<
  { coproprieteId: string; resultat: ResultatEscalade | null; erreur?: string }[]
> {
  const { PrismaClient } = await import("@prisma/client");
  const raw = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  try {
    const coproprietes = await raw.copropriete.findMany({ select: { id: true } });
    const resultats: { coproprieteId: string; resultat: ResultatEscalade | null; erreur?: string }[] = [];
    for (const { id } of coproprietes) {
      try {
        resultats.push({ coproprieteId: id, resultat: await executerEscaladeImpayes(id) });
      } catch (e) {
        resultats.push({ coproprieteId: id, resultat: null, erreur: e instanceof Error ? e.message : String(e) });
      }
    }
    return resultats;
  } finally {
    await raw.$disconnect();
  }
}

/**
 * Doc A §3.3 : N1 = "push + email au copropriétaire". Les paliers suivants notifient aussi le
 * copropriétaire (relance/mise en demeure/plan/suspension/injonction le concernent au premier
 * chef) ; à partir de N4, le syndic est alerté en plus (colonne "Action manuelle syndic" — il
 * doit négocier le plan N4, décider la suspension N5, saisir le tribunal N6).
 */
async function notifierEscalade(
  db: TenantDb,
  coproprieteId: string,
  ligne: {
    id: string;
    lotId: string;
    montantDu: unknown;
    montantPaye: unknown;
    appelDeFonds: { id: string; periode: string };
  },
  niveau: NiveauEscalade
) {
  const contenuJson = {
    appel_de_fonds_lot_id: ligne.id,
    lot_id: ligne.lotId,
    periode: ligne.appelDeFonds.periode,
    niveau,
    montant_du: String(ligne.montantDu),
    montant_paye: String(ligne.montantPaye),
  };

  const proprietaires = await db.lotProprietaire.findMany({
    where: { lotId: ligne.lotId, dateFin: null },
    select: { utilisateurId: true },
  });
  await Promise.all(
    proprietaires.map((p) =>
      envoyerNotification(db, {
        coproprieteId,
        utilisateurId: p.utilisateurId,
        templateCode: `IMPAYE_${niveau}`,
        canal: niveau === "N1" ? "PUSH" : "EMAIL",
        contenuJson,
      })
    )
  );

  if (ORDRE[niveau] >= ORDRE.N4) {
    const syndics = await db.roleUtilisateur.findMany({
      where: { coproprieteId, role: "SYNDIC", actif: true },
      select: { utilisateurId: true },
      distinct: ["utilisateurId"],
    });
    await Promise.all(
      syndics.map((s) =>
        envoyerNotification(db, {
          coproprieteId,
          utilisateurId: s.utilisateurId,
          templateCode: `IMPAYE_${niveau}_SYNDIC`,
          canal: "PUSH",
          contenuJson,
        })
      )
    );
  }
}
