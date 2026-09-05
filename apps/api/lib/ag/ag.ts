/**
 * Service Assemblées Générales — M6 (Master Spec Partie 2.2/8, Doc A §6).
 *
 * ⚠️ MODULE LÉGALEMENT SENSIBLE (docs/LEGAL_QUESTIONS_BRIEF.md §0/§2/§4) : ce fichier implémente
 * la STRUCTURE et les MÉCANIQUES DE CALCUL déjà données noir sur blanc par le Master Spec Partie
 * 8.3/8.4/8.5 (formules de quorum/majorité), mais bloque explicitement (ContrainteMetierError,
 * 422) toute opération qui dépendrait d'une VALEUR légale encore disputée et non confirmée par un
 * avocat (délai de convocation, quorum de 1re convocation, limite de procurations) — jamais de
 * valeur par défaut devinée. Voir `copropriete.delaiConvocationJours` (M1),
 * `copropriete.quorumPremiereConvocation`, `copropriete.limiteProcurationsMandataire`.
 *
 * ⚠️ LIMITE CONNUE — quorum : Master Spec Partie 8.3 définit le quorum comme la part des
 * tantièmes dont le propriétaire (ou son mandataire) a émis AU MOINS UN VOTE. Comme la plateforme
 * ne modélise pas de "présence" indépendante du vote (pas de check-in physique), le quorum réel
 * ne peut être connu qu'après le déroulement des votes — il est donc vérifié à la CLÔTURE
 * (`cloturerAg`), pas à l'ouverture (`ouvrirAg`), qui ne fait que basculer EN_COURS après la date
 * prévue. Le mécanisme légal "quorum non atteint → 2e convocation sans quorum" (Doc A §6.3) n'est
 * pas non plus automatisé : si le quorum manque à la clôture, le syndic doit créer une NOUVELLE
 * AG (2e convocation) manuellement — voir schema.prisma pour la justification complète.
 */
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import { withTenantIdempotent } from "../http/idempotency";
import type { TenantContext } from "../tenant/context";
import { money } from "../money";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import { genererPvPdfBuffer } from "./pv-pdf";
import { televerserDocument } from "../storage/supabase-storage";
import type {
  AgCreateInput,
  AgResolutionCreateInput,
  AgVoteCreateInput,
  AgProcurationCreateInput,
} from "./schemas";

export class PermissionRefuseeError extends Error {}
export class AgIntrouvableError extends Error {}
export class ContrainteMetierError extends Error {}

// ────────────────────────────────────────────────────────────────────────────
// Création / lecture
// ────────────────────────────────────────────────────────────────────────────

export async function creerAg(ctx: TenantContext, input: AgCreateInput) {
  if (can("ag.creer", ctx.role) !== true) {
    throw new PermissionRefuseeError(
      "Seul le syndic peut créer une AG (à réévaluer si Loi 30-24 confirmée — voir LEGAL_QUESTIONS_BRIEF.md §0)."
    );
  }
  return withTenant(ctx, (db) =>
    db.assembleeGenerale.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        type: input.type,
        dateAg: new Date(input.date_ag),
      },
    })
  );
}

export async function listerAg(ctx: TenantContext, page: number, limit: number) {
  if (can("ag.lire", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à lister les AG.");
  }
  return withTenant(ctx, async (db) => {
    const [total, rows] = await Promise.all([
      db.assembleeGenerale.count({ where: { coproprieteId: ctx.coproprieteId } }),
      db.assembleeGenerale.findMany({
        where: { coproprieteId: ctx.coproprieteId },
        orderBy: { dateAg: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, rows };
  });
}

export async function obtenirAg(ctx: TenantContext, agId: string) {
  if (can("ag.lire", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter cette AG.");
  }
  const ag = await withTenant(ctx, (db) =>
    db.assembleeGenerale.findUnique({
      where: { id: agId },
      include: { resolutions: { orderBy: { ordre: "asc" } } },
    })
  );
  if (!ag) throw new AgIntrouvableError("AG introuvable.");
  return ag;
}

// ────────────────────────────────────────────────────────────────────────────
// Convocation / ouverture / annulation
// ────────────────────────────────────────────────────────────────────────────

const JOUR_MS = 24 * 60 * 60 * 1000;

export async function convoquerAg(ctx: TenantContext, agId: string) {
  if (can("ag.convoquer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut convoquer une AG.");
  }
  return withTenant(ctx, async (db) => {
    const [ag, copropriete] = await Promise.all([
      db.assembleeGenerale.findUnique({ where: { id: agId } }),
      db.copropriete.findUnique({ where: { id: ctx.coproprieteId } }),
    ]);
    if (!ag) throw new AgIntrouvableError("AG introuvable.");
    if (ag.statut !== "PLANIFIEE") {
      throw new ContrainteMetierError(`Convocation impossible depuis le statut ${ag.statut}.`);
    }
    if (!copropriete?.delaiConvocationJours) {
      throw new ContrainteMetierError(
        "Délai légal de convocation non configuré (docs/LEGAL_QUESTIONS_BRIEF.md §1) — impossible de vérifier le délai minimum avant confirmation juridique."
      );
    }
    const delaiMs = copropriete.delaiConvocationJours * JOUR_MS;
    if (ag.dateAg.getTime() - Date.now() < delaiMs) {
      throw new ContrainteMetierError(
        `Délai de convocation insuffisant : ${copropriete.delaiConvocationJours} jours minimum requis avant la date de l'AG.`
      );
    }

    const destinataires = await db.roleUtilisateur.findMany({
      where: { coproprieteId: ctx.coproprieteId, actif: true },
      select: { utilisateurId: true },
      distinct: ["utilisateurId"],
    });

    const [updated] = await Promise.all([
      db.assembleeGenerale.update({
        where: { id: agId },
        data: { statut: "CONVOQUEE", dateConvocation: new Date() },
      }),
      db.agNotificationLog.createMany({
        data: destinataires.map((d) => ({
          agId,
          utilisateurId: d.utilisateurId,
          canal: "EMAIL" as const,
        })),
      }),
      // Boîte de réception personnelle générique (M9) — `ag_notification_log` ci-dessus reste la
      // preuve légale d'envoi (Doc A §12.2, append-only, un enregistrement par destinataire+canal),
      // ce `Promise.all` alimente en plus `notification` pour que le destinataire la voie dans
      // `GET /notifications` (sans ce câblage, `ag_notification_log` n'a aucun endpoint de lecture).
      ...destinataires.map((d) =>
        envoyerNotification(db, {
          coproprieteId: ctx.coproprieteId,
          utilisateurId: d.utilisateurId,
          templateCode: "AG_CONVOCATION",
          canal: "EMAIL",
          contenuJson: { ag_id: agId, date_ag: ag.dateAg.toISOString() },
        })
      ),
      ecrireAuditLog(db, {
        coproprieteId: ctx.coproprieteId,
        acteurId: ctx.utilisateurId,
        action: "AG_CONVOQUEE",
        entite: "assemblee_generale",
        entiteId: agId,
        apres: { destinataires: destinataires.length },
      }),
    ]);
    return updated;
  });
}

export async function ouvrirAg(ctx: TenantContext, agId: string) {
  if (can("ag.ouvrir", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut ouvrir une AG.");
  }
  return withTenant(ctx, async (db) => {
    const [ag, copropriete] = await Promise.all([
      db.assembleeGenerale.findUnique({ where: { id: agId } }),
      db.copropriete.findUnique({ where: { id: ctx.coproprieteId } }),
    ]);
    if (!ag) throw new AgIntrouvableError("AG introuvable.");
    if (ag.statut !== "CONVOQUEE") {
      throw new ContrainteMetierError(`Ouverture impossible depuis le statut ${ag.statut}.`);
    }
    if (Date.now() < ag.dateAg.getTime()) {
      throw new ContrainteMetierError("L'AG ne peut pas être ouverte avant la date prévue.");
    }
    if (copropriete?.quorumPremiereConvocation == null) {
      throw new ContrainteMetierError(
        "Quorum légal de 1re convocation non configuré (docs/LEGAL_QUESTIONS_BRIEF.md §2) — confirmation juridique requise avant d'ouvrir une AG."
      );
    }
    const membres = await db.roleUtilisateur.findMany({
      where: { coproprieteId: ctx.coproprieteId, actif: true },
      select: { utilisateurId: true },
      distinct: ["utilisateurId"],
    });
    const [updated] = await Promise.all([
      db.assembleeGenerale.update({
        where: { id: agId },
        data: { statut: "EN_COURS", quorumRequis: copropriete.quorumPremiereConvocation },
      }),
      ...membres.map((m) =>
        envoyerNotification(db, {
          coproprieteId: ctx.coproprieteId,
          utilisateurId: m.utilisateurId,
          templateCode: "AG_OUVERTE",
          canal: "PUSH",
          contenuJson: { ag_id: agId, date_ag: ag.dateAg.toISOString() },
        })
      ),
    ]);
    return updated;
  });
}

export async function annulerAg(ctx: TenantContext, agId: string, motif: string) {
  if (can("ag.annuler", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut annuler une AG.");
  }
  return withTenant(ctx, async (db) => {
    const ag = await db.assembleeGenerale.findUnique({ where: { id: agId } });
    if (!ag) throw new AgIntrouvableError("AG introuvable.");
    if (ag.statut === "CLOTUREE" || ag.statut === "ANNULEE") {
      throw new ContrainteMetierError(`Annulation impossible depuis le statut ${ag.statut}.`);
    }
    // Une AG déjà convoquée : tous les membres actifs sont informés de l'annulation.
    const destinataires =
      ag.statut === "CONVOQUEE" || ag.statut === "EN_COURS"
        ? await db.roleUtilisateur.findMany({
            where: { coproprieteId: ctx.coproprieteId, actif: true },
            select: { utilisateurId: true },
            distinct: ["utilisateurId"],
          })
        : [];
    const [updated] = await Promise.all([
      db.assembleeGenerale.update({
        where: { id: agId },
        data: { statut: "ANNULEE", motifAnnulation: motif },
      }),
      ecrireAuditLog(db, {
        coproprieteId: ctx.coproprieteId,
        acteurId: ctx.utilisateurId,
        action: "AG_ANNULEE",
        entite: "assemblee_generale",
        entiteId: agId,
        apres: { motif },
      }),
      ...destinataires.map((d) =>
        envoyerNotification(db, {
          coproprieteId: ctx.coproprieteId,
          utilisateurId: d.utilisateurId,
          templateCode: "AG_ANNULEE",
          canal: "EMAIL",
          contenuJson: { ag_id: agId, date_ag: ag.dateAg.toISOString(), motif },
        })
      ),
    ]);
    return updated;
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Résolutions
// ────────────────────────────────────────────────────────────────────────────

export async function creerResolution(
  ctx: TenantContext,
  agId: string,
  input: AgResolutionCreateInput
) {
  if (can("ag.gerer_resolutions", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut ajouter une résolution.");
  }
  return withTenant(ctx, (db) => creerResolutionDb(db, agId, input));
}

/**
 * Cœur de la création d'une résolution, réutilisable dans une transaction tenant déjà ouverte
 * (M18 : soumission du rapport de gestion → résolution « approbation des comptes » créée par CE
 * service, jamais dupliqué). Les contrôles de permission restent à la charge de l'appelant.
 */
export async function creerResolutionDb(db: TenantDb, agId: string, input: AgResolutionCreateInput) {
  const ag = await db.assembleeGenerale.findUnique({ where: { id: agId } });
  if (!ag) throw new AgIntrouvableError("AG introuvable.");
  if (ag.statut === "CLOTUREE" || ag.statut === "ANNULEE") {
    throw new ContrainteMetierError(`Ajout de résolution impossible depuis le statut ${ag.statut}.`);
  }
  return db.agResolution.create({
    data: { agId, ordre: input.ordre, texte: input.texte, typeMajorite: input.type_majorite },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Votes
// ────────────────────────────────────────────────────────────────────────────

/**
 * Doc A §2.4 : blocage du vote d'un INDIVISAIRE si le lot a un impayé — test critique
 * (ROADMAP_BACKLOG.md M6). Vérifié ici explicitement pour ce rôle uniquement : Doc A §6.3 ne
 * confirme PAS un blocage général pour tous les débiteurs ("certains règlements le prévoient",
 * pas une règle par défaut) — étendre à d'autres rôles serait une invention non demandée.
 */
async function assertIndivisaireLotSolde(db: TenantDb, lotId: string) {
  const impaye = await db.appelDeFondsLot.findFirst({
    where: { lotId, statut: "IMPAYE" },
  });
  if (impaye) {
    throw new ContrainteMetierError(
      "Vote bloqué : ce lot en indivision a un solde de charges impayé (Doc A §2.4)."
    );
  }
}

export async function voter(
  ctx: TenantContext,
  agId: string,
  input: AgVoteCreateInput,
  idempotencyKey?: string
) {
  const permission = can("ag.voter", ctx.role);
  if (permission === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à voter en AG.");
  }
  return withTenantIdempotent(
    ctx,
    { cle: idempotencyKey, endpoint: "POST /ag/:id/votes", payload: { agId, ...input } },
    async (db) => {
    const ag = await db.assembleeGenerale.findUnique({ where: { id: agId } });
    if (!ag) throw new AgIntrouvableError("AG introuvable.");
    if (ag.statut !== "EN_COURS") {
      throw new ContrainteMetierError("Le vote n'est ouvert que pendant le déroulement de l'AG (statut EN_COURS).");
    }
    const resolution = await db.agResolution.findUnique({ where: { id: input.resolution_id } });
    if (!resolution || resolution.agId !== agId) {
      throw new AgIntrouvableError("Résolution introuvable pour cette AG.");
    }
    if (resolution.resultat !== "EN_ATTENTE") {
      throw new ContrainteMetierError("Cette résolution est déjà finalisée — vote impossible.");
    }

    let lotId: string;
    if (input.procuration_id) {
      const procuration = await db.agProcuration.findUnique({ where: { id: input.procuration_id } });
      if (!procuration || procuration.agId !== agId) {
        throw new AgIntrouvableError("Procuration introuvable pour cette AG.");
      }
      if (procuration.revoqueeLe) {
        throw new ContrainteMetierError("Cette procuration a été révoquée.");
      }
      if (procuration.mandataireId !== ctx.utilisateurId) {
        throw new PermissionRefuseeError("Cette procuration ne vous est pas attribuée.");
      }
      lotId = procuration.lotId;
    } else {
      if (!input.lot_id) {
        throw new ContrainteMetierError("lot_id requis pour un vote direct (sans procuration).");
      }
      lotId = input.lot_id;
      const proprietaire = await db.lotProprietaire.findFirst({
        where: { lotId, utilisateurId: ctx.utilisateurId, dateFin: null },
      });
      if (!proprietaire) {
        throw new PermissionRefuseeError("Vous n'êtes pas copropriétaire actif de ce lot.");
      }
      // Doc A §2.4 : indivision → seul le représentant désigné vote pour le lot.
      if (proprietaire.typePropriete === "INDIVISION" && !proprietaire.estRepresentantIndivision) {
        throw new PermissionRefuseeError(
          "Seul le représentant désigné de l'indivision peut voter pour ce lot (Doc A §2.4)."
        );
      }
    }

    if (ctx.role === "INDIVISAIRE") {
      await assertIndivisaireLotSolde(db, lotId);
    }

    // Fonction SECURITY DEFINER plutôt qu'un `db.lot.findUnique` direct : dans le cas d'un vote
    // par procuration, le mandataire connecté n'est ni propriétaire ni occupant du lot du
    // mandant — la policy RLS "tenant_isolation" sur `lot` (M3) le lui cacherait autrement.
    const tantiemesRows = await db.$queryRaw<{ tantiemes: Prisma.Decimal | null }[]>`
      SELECT public.lot_tantiemes(${lotId}::uuid) AS tantiemes
    `;
    const tantiemes = tantiemesRows[0]?.tantiemes;
    if (tantiemes == null) throw new AgIntrouvableError("Lot introuvable.");

    try {
      return await db.agVote.create({
        data: {
          resolutionId: input.resolution_id,
          lotId,
          utilisateurId: ctx.utilisateurId,
          valeur: input.valeur,
          tantiemesRepresentes: money(tantiemes.toString()).toString(),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ContrainteMetierError("Ce lot a déjà voté pour cette résolution.");
      }
      throw e;
    }
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Résultats agrégés / nominatifs (Doc A §12.3 : anonymisé résident, nominatif syndic)
// ────────────────────────────────────────────────────────────────────────────

type ResultatLigne = { valeur: "POUR" | "CONTRE" | "ABSTENTION"; nb_votants: number; tantiemes_total: string };

async function resultatsBruts(db: TenantDb, resolutionId: string): Promise<ResultatLigne[]> {
  const lignes = await db.$queryRaw<
    Array<{ valeur: ResultatLigne["valeur"]; nb_votants: bigint; tantiemes_total: string }>
  >`
    SELECT * FROM public.ag_resultats_resolution(${resolutionId}::uuid)
  `;
  // nb_votants est un bigint Postgres → BigInt JS, que Response.json() ne sait pas sérialiser
  // (TypeError). Un comptage de votants tient largement dans un number.
  return lignes.map((l) => ({
    valeur: l.valeur,
    nb_votants: Number(l.nb_votants),
    tantiemes_total: String(l.tantiemes_total),
  }));
}

export async function obtenirResultatsResolution(ctx: TenantContext, resolutionId: string) {
  if (can("ag.lire", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter les résultats.");
  }
  return withTenant(ctx, (db) => resultatsBruts(db, resolutionId));
}

export async function listerVotesNominatifs(ctx: TenantContext, resolutionId: string) {
  if (can("ag.voir_detail_nominatif_votes", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic voit le détail nominatif des votes.");
  }
  return withTenant(ctx, (db) =>
    db.agVote.findMany({ where: { resolutionId }, orderBy: { horodatage: "asc" } })
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Finalisation résolution / clôture AG / PV
// ────────────────────────────────────────────────────────────────────────────

/**
 * Master Spec Partie 8.4 : mécanique de calcul déjà confirmée (pas un paramètre légal disputé) —
 * seule la grille "quelle résolution nécessite quelle majorité" est disputée (LEGAL_QUESTIONS_BRIEF.md
 * §3), et cette grille N'EST PAS appliquée automatiquement ici : le syndic choisit explicitement
 * type_majorite par résolution à la création (`creerResolution`), on ne devine jamais depuis le
 * texte de la résolution.
 */
function calculerResultat(
  typeMajorite: "SIMPLE" | "DOUBLE" | "UNANIMITE",
  tallies: ResultatLigne[],
  totalTantiemesCopropriete: string | null
): "ADOPTEE" | "REJETEE" {
  const tantiemesPour = money(tallies.find((t) => t.valeur === "POUR")?.tantiemes_total ?? 0);
  const tantiemesContre = money(tallies.find((t) => t.valeur === "CONTRE")?.tantiemes_total ?? 0);
  const nbPour = Number(tallies.find((t) => t.valeur === "POUR")?.nb_votants ?? 0);
  const nbContre = Number(tallies.find((t) => t.valeur === "CONTRE")?.nb_votants ?? 0);

  // Master Spec Partie 8.4 : "Égalité parfaite (50/50) → REJETÉE par défaut" — s'applique avant
  // toute autre règle, quel que soit le type de majorité (Doc A §12.2 confirme le cas général).
  if (!tantiemesPour.isZero() && tantiemesPour.equals(tantiemesContre)) {
    return "REJETEE";
  }

  if (typeMajorite === "UNANIMITE") {
    if (!totalTantiemesCopropriete) {
      throw new ContrainteMetierError(
        "Impossible de calculer une majorité UNANIMITE : copropriete.total_tantiemes non configuré."
      );
    }
    return tantiemesPour.equals(money(totalTantiemesCopropriete)) && tantiemesContre.isZero()
      ? "ADOPTEE"
      : "REJETEE";
  }

  if (typeMajorite === "DOUBLE") {
    const majoriteNombre = nbPour > nbContre;
    const majoriteTantiemes = tantiemesPour.greaterThan(tantiemesContre);
    return majoriteNombre && majoriteTantiemes ? "ADOPTEE" : "REJETEE";
  }

  // SIMPLE
  return tantiemesPour.greaterThan(tantiemesContre) ? "ADOPTEE" : "REJETEE";
}

export async function finaliserResolution(ctx: TenantContext, agId: string, resolutionId: string) {
  if (can("ag.finaliser_resolution", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut finaliser une résolution.");
  }
  return withTenant(ctx, async (db) => {
    const [ag, resolution, copropriete] = await Promise.all([
      db.assembleeGenerale.findUnique({ where: { id: agId } }),
      db.agResolution.findUnique({ where: { id: resolutionId } }),
      db.copropriete.findUnique({ where: { id: ctx.coproprieteId } }),
    ]);
    if (!ag || !resolution || resolution.agId !== agId) {
      throw new AgIntrouvableError("AG ou résolution introuvable.");
    }
    if (ag.statut !== "EN_COURS") {
      throw new ContrainteMetierError("Finalisation possible uniquement pendant le statut EN_COURS.");
    }
    if (resolution.resultat !== "EN_ATTENTE") {
      throw new ContrainteMetierError("Cette résolution est déjà finalisée.");
    }
    const tallies = await resultatsBruts(db, resolutionId);
    const resultat = calculerResultat(
      resolution.typeMajorite,
      tallies,
      copropriete?.totalTantiemes ? money(copropriete.totalTantiemes).toString() : null
    );
    const maj = await db.agResolution.update({ where: { id: resolutionId }, data: { resultat } });
    // M18 — hook : une résolution « approbation des comptes » finalisée bascule le rapport de gestion
    // lié en APPROUVE / REJETE (Doc A §6 / §8) — même transaction, audité.
    const { finaliserRapportsLies } = await import("../rapports/gestion");
    await finaliserRapportsLies(db, ctx, resolutionId, resultat);
    return maj;
  });
}

/**
 * Quorum à la clôture (Master Spec Partie 8.3 : part des tantièmes des lots ayant émis au moins
 * un vote, toutes résolutions confondues) — voir limite documentée en tête de fichier.
 */
async function calculerQuorumAtteint(db: TenantDb, agId: string, totalTantiemes: string | null) {
  if (!totalTantiemes) return null;
  const votes = await db.agVote.findMany({
    where: { resolution: { agId } },
    distinct: ["lotId"],
    select: { tantiemesRepresentes: true },
  });
  const sommeTantiemes = votes.reduce((acc, v) => acc.plus(money(v.tantiemesRepresentes)), money(0));
  return sommeTantiemes.dividedBy(money(totalTantiemes)).toDecimalPlaces(3).toString();
}

export async function cloturerAg(ctx: TenantContext, agId: string) {
  if (can("ag.cloturer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut clôturer une AG.");
  }
  return withTenant(ctx, async (db) => {
    const [ag, copropriete] = await Promise.all([
      db.assembleeGenerale.findUnique({
        where: { id: agId },
        include: { resolutions: { orderBy: { ordre: "asc" } } },
      }),
      db.copropriete.findUnique({ where: { id: ctx.coproprieteId } }),
    ]);
    if (!ag) throw new AgIntrouvableError("AG introuvable.");
    if (ag.statut !== "EN_COURS") {
      throw new ContrainteMetierError(`Clôture impossible depuis le statut ${ag.statut}.`);
    }
    const enAttente = ag.resolutions.filter((r) => r.resultat === "EN_ATTENTE");
    if (enAttente.length > 0) {
      throw new ContrainteMetierError(
        `${enAttente.length} résolution(s) en attente de vote — finalisez-les avant de clôturer.`
      );
    }

    const quorumAtteint = await calculerQuorumAtteint(
      db,
      agId,
      copropriete?.totalTantiemes ? money(copropriete.totalTantiemes).toString() : null
    );
    if (ag.quorumRequis != null && quorumAtteint != null && money(quorumAtteint).lessThan(money(ag.quorumRequis))) {
      throw new ContrainteMetierError(
        `Quorum non atteint (${quorumAtteint} < ${ag.quorumRequis.toString()}) — Doc A §6.3 : une 2e convocation doit être organisée (nouvelle AG, quorum non requis).`
      );
    }

    const contenu = {
      ag_id: agId,
      type: ag.type,
      date_ag: ag.dateAg.toISOString(),
      quorum_requis: ag.quorumRequis?.toString() ?? null,
      quorum_atteint: quorumAtteint,
      resolutions: ag.resolutions.map((r) => ({
        id: r.id,
        ordre: r.ordre,
        texte: r.texte,
        type_majorite: r.typeMajorite,
        resultat: r.resultat,
      })),
    };
    const hashIntegrite = createHash("sha256").update(JSON.stringify(contenu)).digest("hex");

    // PDF du PV (M6/M9) — généré et téléversé AVANT l'INSERT car `ag_pv` est append-only
    // (GRANT SELECT, INSERT uniquement — aucun UPDATE possible après coup). Best-effort : le PDF
    // est un RENDU de contenu_json (la preuve légale reste contenu_json + hash_integrite en
    // base) ; si le bucket Storage n'est pas provisionné (dev local sans bucket "documents"),
    // la clôture n'échoue pas — pdf_url reste null et l'échec est tracé dans l'audit_log.
    const horodatageGeneration = new Date();
    let pdfUrl: string | null = null;
    let pdfErreur: string | null = null;
    try {
      const pdfBuffer = await genererPvPdfBuffer({
        coproprieteNom: copropriete?.nom ?? "Copropriété",
        agId,
        type: ag.type,
        dateAg: ag.dateAg.toISOString(),
        quorumRequis: ag.quorumRequis?.toString() ?? null,
        quorumAtteint,
        resolutions: ag.resolutions.map((r) => ({
          ordre: r.ordre,
          texte: r.texte,
          typeMajorite: r.typeMajorite,
          resultat: r.resultat,
        })),
        hashIntegrite,
        horodatageGeneration: horodatageGeneration.toISOString(),
      });
      pdfUrl = await televerserDocument(
        `${ctx.coproprieteId}/ag-pv/${agId}.pdf`,
        pdfBuffer,
        "application/pdf"
      );
    } catch (e) {
      pdfErreur = e instanceof Error ? e.message : String(e);
    }

    const [updated, pv] = await Promise.all([
      db.assembleeGenerale.update({
        where: { id: agId },
        data: { statut: "CLOTUREE", quorumAtteint: quorumAtteint ?? undefined },
      }),
      db.agPv.create({
        data: { agId, contenuJson: contenu, hashIntegrite, pdfUrl },
      }),
    ]);
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "AG_PV_GENERE",
      entite: "assemblee_generale",
      entiteId: agId,
      apres: {
        pv_id: pv.id,
        hash_integrite: hashIntegrite,
        pdf_url: pdfUrl,
        ...(pdfErreur ? { pdf_erreur: pdfErreur } : {}),
      },
    });

    // Matrice Master Spec 7.1 : "PV d'AG disponible → Email + push → Copropriétaires
    // (+ locataires si option activée)" — option = copropriete.config_json.locataire_voit_pv.
    const rolesPv: ("PROPRIETAIRE" | "INDIVISAIRE" | "PERSONNE_MORALE_REPRESENTANT" | "LOCATAIRE")[] =
      ["PROPRIETAIRE", "INDIVISAIRE", "PERSONNE_MORALE_REPRESENTANT"];
    const locataireVoitPv =
      typeof copropriete?.configJson === "object" &&
      copropriete?.configJson !== null &&
      (copropriete.configJson as Record<string, unknown>).locataire_voit_pv === true;
    if (locataireVoitPv) rolesPv.push("LOCATAIRE");
    const destinatairesPv = await db.roleUtilisateur.findMany({
      where: { coproprieteId: ctx.coproprieteId, actif: true, role: { in: rolesPv } },
      select: { utilisateurId: true },
      distinct: ["utilisateurId"],
    });
    await Promise.all(
      destinatairesPv.flatMap((d) =>
        (["EMAIL", "PUSH"] as const).map((canal) =>
          envoyerNotification(db, {
            coproprieteId: ctx.coproprieteId,
            utilisateurId: d.utilisateurId,
            templateCode: "PV_DISPONIBLE",
            canal,
            contenuJson: { ag_id: agId, date_ag: ag.dateAg.toISOString() },
          })
        )
      )
    );

    return { ag: updated, pv };
  });
}

export async function obtenirPv(ctx: TenantContext, agId: string) {
  if (can("ag.lire", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter le PV.");
  }
  const pv = await withTenant(ctx, (db) => db.agPv.findUnique({ where: { agId } }));
  if (!pv) throw new AgIntrouvableError("PV introuvable — l'AG n'est probablement pas encore clôturée.");
  return pv;
}

/**
 * GET /ag/:id/pv/pdf — URL signée (15 min) du PDF du PV. Le PDF est un rendu déterministe de
 * `contenu_json` : si la clôture n'avait pas pu le téléverser (bucket absent à l'époque), il
 * est régénéré ici sur le chemin canonique — la ligne `ag_pv` append-only n'est jamais
 * modifiée, la preuve légale reste contenu_json + hash_integrite.
 */
export async function obtenirPvPdfUrl(ctx: TenantContext, agId: string) {
  const pv = await obtenirPv(ctx, agId);
  const chemin = pv.pdfUrl ?? `${ctx.coproprieteId}/ag-pv/${agId}.pdf`;
  if (!pv.pdfUrl) {
    const [ag, copropriete] = await withTenant(ctx, (db) =>
      Promise.all([
        db.assembleeGenerale.findUnique({ where: { id: agId } }),
        db.copropriete.findUnique({ where: { id: ctx.coproprieteId } }),
      ])
    );
    const contenu = pv.contenuJson as {
      type?: string;
      date_ag?: string;
      quorum_requis?: string | null;
      quorum_atteint?: string | null;
      resolutions?: { ordre: number; texte: string; type_majorite: string; resultat: string }[];
    };
    const pdfBuffer = await genererPvPdfBuffer({
      coproprieteNom: copropriete?.nom ?? "Copropriété",
      agId,
      type: contenu.type ?? ag?.type ?? "ORDINAIRE",
      dateAg: contenu.date_ag ?? ag?.dateAg.toISOString() ?? new Date(0).toISOString(),
      quorumRequis: contenu.quorum_requis ?? null,
      quorumAtteint: contenu.quorum_atteint ?? null,
      resolutions: (contenu.resolutions ?? []).map((r) => ({
        ordre: r.ordre,
        texte: r.texte,
        typeMajorite: r.type_majorite,
        resultat: r.resultat,
      })),
      hashIntegrite: pv.hashIntegrite,
      horodatageGeneration: pv.horodatageGeneration.toISOString(),
    });
    await televerserDocument(chemin, pdfBuffer, "application/pdf");
  }
  const { creerUrlSignee } = await import("../storage/supabase-storage");
  return { url: await creerUrlSignee(chemin) };
}

// ────────────────────────────────────────────────────────────────────────────
// Procurations (Doc A §6.5)
// ────────────────────────────────────────────────────────────────────────────

/**
 * GET /ag/:id/procurations — le syndic voit toutes les procurations de l'AG ; un rôle scoped
 * voit celles où il est mandant OU mandataire (nécessaire pour voter en séance au nom d'un
 * mandant). La RLS sur ag_procuration reste la seconde couche.
 */
export async function listerProcurations(ctx: TenantContext, agId: string) {
  const permission = can("ag.gerer_procurations", ctx.role);
  if (permission === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter les procurations.");
  }
  return withTenant(ctx, async (db) => {
    const ag = await db.assembleeGenerale.findUnique({ where: { id: agId } });
    if (!ag) throw new AgIntrouvableError("AG introuvable.");
    return db.agProcuration.findMany({
      where: {
        agId,
        ...(permission === "scoped"
          ? { OR: [{ mandantId: ctx.utilisateurId }, { mandataireId: ctx.utilisateurId }] }
          : {}),
      },
      orderBy: { creeLe: "asc" },
    });
  });
}

export async function creerProcuration(
  ctx: TenantContext,
  agId: string,
  input: AgProcurationCreateInput
) {
  const permission = can("ag.gerer_procurations", ctx.role);
  if (permission === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à créer une procuration.");
  }
  return withTenant(ctx, async (db) => {
    const ag = await db.assembleeGenerale.findUnique({ where: { id: agId } });
    if (!ag) throw new AgIntrouvableError("AG introuvable.");
    if (ag.statut === "CLOTUREE" || ag.statut === "ANNULEE") {
      throw new ContrainteMetierError(`Procuration impossible depuis le statut ${ag.statut}.`);
    }

    // Un mandant "scoped" ne peut désigner que lui-même ; seul le syndic peut spécifier un
    // mandant_id différent (procuration papier reçue physiquement, Doc A §6.5).
    const mandantId =
      permission === "scoped" ? ctx.utilisateurId : (input.mandant_id ?? ctx.utilisateurId);

    if (mandantId === input.mandataire_id) {
      throw new ContrainteMetierError("Le mandant et le mandataire ne peuvent pas être la même personne.");
    }

    const proprietaireMandant = await db.lotProprietaire.findFirst({
      where: { lotId: input.lot_id, utilisateurId: mandantId, dateFin: null },
    });
    if (!proprietaireMandant) {
      throw new ContrainteMetierError("Le mandant n'est pas copropriétaire actif de ce lot.");
    }

    if (ag.coproprieteId !== ctx.coproprieteId) {
      throw new AgIntrouvableError("AG introuvable.");
    }

    const copropriete = await db.copropriete.findUnique({ where: { id: ctx.coproprieteId } });
    if (copropriete?.limiteProcurationsMandataire != null) {
      // Fonction SECURITY DEFINER : un nouveau mandant n'est ni mandant ni mandataire des
      // procurations déjà existantes d'un tiers — la policy RLS "tenant_isolation" sur
      // `ag_procuration` (M6) les lui cacherait dans un COUNT scopé à sa propre session.
      const rows = await db.$queryRaw<{ count: bigint }[]>`
        SELECT public.ag_procurations_actives_count(${agId}::uuid, ${input.mandataire_id}::uuid) AS count
      `;
      const nbActives = Number(rows[0]?.count ?? 0n);
      if (nbActives >= copropriete.limiteProcurationsMandataire) {
        throw new ContrainteMetierError(
          `Limite légale de ${copropriete.limiteProcurationsMandataire} procuration(s) par mandataire atteinte (Doc A §6.5).`
        );
      }
    }
    // Si non configuré : aucune limite appliquée — LEGAL_QUESTIONS_BRIEF.md §4, pas de valeur
    // devinée (le "3" trouvé en source secondaire n'est PAS confirmé par un avocat).

    return db.agProcuration.create({
      data: { agId, lotId: input.lot_id, mandantId, mandataireId: input.mandataire_id },
    });
  });
}

export async function revoquerProcuration(ctx: TenantContext, agId: string, procurationId: string) {
  const permission = can("ag.gerer_procurations", ctx.role);
  if (permission === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à révoquer cette procuration.");
  }
  return withTenant(ctx, async (db) => {
    const procuration = await db.agProcuration.findUnique({ where: { id: procurationId } });
    if (!procuration || procuration.agId !== agId) {
      throw new AgIntrouvableError("Procuration introuvable.");
    }
    if (permission === "scoped" && procuration.mandantId !== ctx.utilisateurId) {
      throw new PermissionRefuseeError("Seul le mandant peut révoquer sa propre procuration.");
    }
    if (procuration.revoqueeLe) {
      throw new ContrainteMetierError("Cette procuration est déjà révoquée.");
    }
    return db.agProcuration.update({
      where: { id: procurationId },
      data: { revoqueeLe: new Date() },
    });
  });
}
