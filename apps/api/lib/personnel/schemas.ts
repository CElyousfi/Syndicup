/**
 * Schémas Zod — M10 Personnel / gardien & visites (Master Spec Partie 2.2/13.3, Doc A §9).
 */
import { z } from "zod";

export const personnelCreateSchema = z.object({
  utilisateur_id: z.string().uuid(),
  statut: z.enum(["PRE_EMBAUCHE", "PRESENT", "ABSENT", "REMPLACE"]).optional(),
  logement_lot_id: z.string().uuid().nullable().optional(),
  // M20
  poste: z.enum(["GARDIEN", "AGENT_ENTRETIEN", "JARDINIER", "AGENT_SECURITE", "AUTRE"]).optional(),
});
export type PersonnelCreateInput = z.infer<typeof personnelCreateSchema>;

export const personnelChangerStatutSchema = z.object({
  statut: z.enum(["PRE_EMBAUCHE", "PRESENT", "ABSENT", "REMPLACE", "PARTI"]),
  logement_lot_id: z.string().uuid().nullable().optional(),
});
export type PersonnelChangerStatutInput = z.infer<typeof personnelChangerStatutSchema>;

export const visiteCreateSchema = z.object({
  lot_id: z.string().uuid(),
  visiteur_nom: z.string().min(1).max(200),
});
export type VisiteCreateInput = z.infer<typeof visiteCreateSchema>;

// EN_ATTENTE est l'état initial (défaut à la création), jamais une cible de transition.
export const visiteChangerStatutSchema = z.object({
  statut: z.enum(["AUTORISE", "REFUSE"]),
});
export type VisiteChangerStatutInput = z.infer<typeof visiteChangerStatutSchema>;

// ── M20 — RH : contrat de travail, paie, congés, présences, évaluations ─────────────
import { regexCheminModule } from "../documents/attach";
import { parametresPaieSchema } from "./paie";

export const POSTES_PERSONNEL = ["GARDIEN", "AGENT_ENTRETIEN", "JARDINIER", "AGENT_SECURITE", "AUTRE"] as const;
export const TYPES_CONTRAT_TRAVAIL = ["CDI", "CDD", "ANAPEC", "STAGE", "AUTRE"] as const;
export const STATUTS_PERSONNEL = ["PRE_EMBAUCHE", "PRESENT", "ABSENT", "REMPLACE", "PARTI"] as const;
export const TYPES_CONGE = ["ANNUEL", "MALADIE", "SANS_SOLDE", "EXCEPTIONNEL"] as const;
export const STATUTS_PRESENCE = ["PRESENT", "ABSENT", "CONGE", "MALADIE"] as const;

const uuid = z.string().uuid();
const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format YYYY-MM-DD.");
const periode = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Période invalide (format "YYYY-MM").');
const montant = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Montant décimal invalide (ex. "1250.50").');
const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue au format HH:MM.");
const plage = z.object({ debut: heure, fin: heure });
export const horairesSchema = z.object({ lun: z.array(plage).max(4).optional(), mar: z.array(plage).max(4).optional(), mer: z.array(plage).max(4).optional(), jeu: z.array(plage).max(4).optional(), ven: z.array(plage).max(4).optional(), sam: z.array(plage).max(4).optional(), dim: z.array(plage).max(4).optional() });

export const pieceRhSchema = z.object({
  storage_path: z.string().regex(regexCheminModule("personnel"), "Chemin de fichier invalide."),
  nom: z.string().min(1).max(200),
});
export const personnelUploadUrlSchema = z.object({
  nom_fichier: z.string().min(1).max(180),
  content_type: z.string().regex(/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/, "Image ou PDF uniquement."),
});
export type PersonnelUploadUrlInput = z.infer<typeof personnelUploadUrlSchema>;

export const personnelRhUpdateSchema = z
  .object({
    poste: z.enum(POSTES_PERSONNEL).optional(),
    type_contrat: z.enum(TYPES_CONTRAT_TRAVAIL).nullish(),
    date_embauche: dateIso.nullish(),
    date_fin_contrat: dateIso.nullish(),
    salaire_brut_mensuel: montant.nullish(),
    numero_cnss: z.string().regex(/^\d{6,12}$/, "N° CNSS : 6 à 12 chiffres.").nullish(),
    contact_urgence: z.string().min(1).max(200).nullish(),
    horaires: horairesSchema.nullish(),
    notes: z.string().max(4000).nullish(),
    statut: z.enum(STATUTS_PERSONNEL).optional(),
    logement_lot_id: uuid.nullish(),
    contrat_travail: pieceRhSchema.nullish(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Aucun champ à modifier.")
  .refine((v) => !(v.date_embauche && v.date_fin_contrat && v.date_fin_contrat < v.date_embauche), { path: ["date_fin_contrat"], message: "La fin de contrat doit suivre l'embauche." });
export type PersonnelRhUpdateInput = z.infer<typeof personnelRhUpdateSchema>;

export const fichePaieCreateSchema = z.object({
  periode,
  brut: montant.optional(), // défaut = salaire brut mensuel de la fiche
  primes: montant.nullish(),
  retenues: montant.nullish(),
  // Défaut = présences ABSENT du mois (non justifiées).
  jours_absence_injustifiee: z.number().int().min(0).max(31).optional(),
});
export type FichePaieCreateInput = z.infer<typeof fichePaieCreateSchema>;
export const fichePaieUpdateSchema = fichePaieCreateSchema.omit({ periode: true }).refine((v) => Object.values(v).some((x) => x !== undefined), "Aucun champ à modifier.");
export type FichePaieUpdateInput = z.infer<typeof fichePaieUpdateSchema>;

export const congeCreateSchema = z
  .object({
    personnel_id: uuid.optional(), // syndic au nom d'un employé ; l'employé : sa propre fiche
    type: z.enum(TYPES_CONGE),
    date_debut: dateIso,
    date_fin: dateIso,
    nb_jours: z.string().regex(/^\d{1,3}(\.5)?$/, "Jours (demi-journées possibles).").optional(),
    motif: z.string().max(1000).nullish(),
    certificat: pieceRhSchema.nullish(),
    remplacant_personnel_id: uuid.nullish(),
  })
  .refine((v) => v.date_fin >= v.date_debut, { path: ["date_fin"], message: "La date de fin doit suivre la date de début." });
export type CongeCreateInput = z.infer<typeof congeCreateSchema>;
export const congeDeciderSchema = z.object({ motif_refus: z.string().min(1).max(1000).optional(), remplacant_personnel_id: uuid.nullish() });
export type CongeDeciderInput = z.infer<typeof congeDeciderSchema>;
export const congesFiltresSchema = z.object({ statut: z.enum(["DEMANDE", "APPROUVE", "REFUSE", "ANNULE"]).optional(), annee: z.string().regex(/^\d{4}$/).optional() });

export const presencesUpsertSchema = z.object({
  presences: z.array(z.object({ date: dateIso, statut: z.enum(STATUTS_PRESENCE), commentaire: z.string().max(500).nullish() })).min(1).max(62),
});
export type PresencesUpsertInput = z.infer<typeof presencesUpsertSchema>;
export const presenceSelfSchema = z.object({ date: dateIso.optional(), statut: z.enum(["PRESENT", "ABSENT", "MALADIE"]).default("PRESENT"), commentaire: z.string().max(500).nullish() });
export type PresenceSelfInput = z.infer<typeof presenceSelfSchema>;
export const presencesQuerySchema = z.object({ from: dateIso, to: dateIso }).refine((v) => v.to >= v.from, "`to` doit suivre `from`.");

export const evaluationCreateSchema = z.object({
  periode: z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]|S[12]|T[1-4]))?$/, 'Période « YYYY », « YYYY-MM », « YYYY-S1 » ou « YYYY-T1 ».'),
  note: z.number().int().min(1).max(5),
  commentaire: z.string().max(2000).nullish(),
});
export type EvaluationCreateInput = z.infer<typeof evaluationCreateSchema>;

export const planningQuerySchema = z.object({ semaine: dateIso.optional() });
export const parametresPaieUpdateSchema = z.object({ parametres_paie: parametresPaieSchema.nullable() });
export const fichesPaieFiltresSchema = z.object({ periode: periode.optional(), statut: z.enum(["BROUILLON", "VALIDEE", "PAYEE"]).optional() });
