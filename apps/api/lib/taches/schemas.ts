/**
 * Schémas Zod — M22 Tâches et suivi des décisions (Doc A §6 exécution des résolutions, §8
 * obligations récurrentes du syndic). Dates « YYYY-MM-DD », checklist et récurrence fermées.
 */
import { z } from "zod";
import { regexCheminModule } from "../documents/attach";

export const ORIGINES_TACHE = ["MANUELLE", "RESOLUTION_AG", "CONTRAT", "INCIDENT", "RAPPORT", "SYSTEME"] as const;
export const PRIORITES_TACHE = ["BASSE", "NORMALE", "HAUTE", "CRITIQUE"] as const;
export const STATUTS_TACHE = ["A_FAIRE", "EN_COURS", "BLOQUEE", "TERMINEE", "ANNULEE"] as const;
export type StatutTache = (typeof STATUTS_TACHE)[number];
export const FREQUENCES_RECURRENCE = ["MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE"] as const;
export type FrequenceRecurrence = (typeof FREQUENCES_RECURRENCE)[number];

const uuid = z.string().uuid();
const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format YYYY-MM-DD.");

export const checklistItemSchema = z.object({ id: z.string().regex(/^[a-z0-9_-]{1,40}$/i).optional(), libelle: z.string().min(1).max(200), fait: z.boolean().default(false) });
export const recurrenceSchema = z.object({ frequence: z.enum(FREQUENCES_RECURRENCE) });
export type RecurrenceInput = z.infer<typeof recurrenceSchema>;

export const pieceTacheSchema = z.object({
  storage_path: z.string().regex(regexCheminModule("taches"), "Chemin de fichier invalide."),
  nom: z.string().min(1).max(200),
});
export const tacheUploadUrlSchema = z.object({
  nom_fichier: z.string().min(1).max(180),
  content_type: z.string().regex(/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/, "Image ou PDF uniquement."),
});
export type TacheUploadUrlInput = z.infer<typeof tacheUploadUrlSchema>;

const tacheBase = {
  titre: z.string().min(1).max(200),
  description: z.string().max(8000).nullish(),
  assignee_id: uuid.nullish(),
  priorite: z.enum(PRIORITES_TACHE).default("NORMALE"),
  date_echeance: dateIso.nullish(),
  checklist: z.array(checklistItemSchema).max(50).nullish(),
  recurrence: recurrenceSchema.nullish(),
  visible_conseil: z.boolean().default(true),
  pieces_jointes: z.array(pieceTacheSchema).max(10).default([]),
};
export const tacheCreateSchema = z.object(tacheBase);
export type TacheCreateInput = z.infer<typeof tacheCreateSchema>;
export const tacheUpdateSchema = z
  .object({ ...tacheBase, priorite: z.enum(PRIORITES_TACHE), visible_conseil: z.boolean(), pieces_jointes: z.array(pieceTacheSchema).max(10) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type TacheUpdateInput = z.infer<typeof tacheUpdateSchema>;

export const tacheStatutSchema = z.object({
  statut: z.enum(STATUTS_TACHE),
  commentaire: z.string().max(4000).nullish(),
  /** Photo / pièce jointe accompagnant le changement (mobile : « terminé avec photo »). */
  piece_jointe: pieceTacheSchema.nullish(),
});
export type TacheStatutInput = z.infer<typeof tacheStatutSchema>;
export const tacheAssignerSchema = z.object({ assignee_id: uuid.nullable() });
export type TacheAssignerInput = z.infer<typeof tacheAssignerSchema>;
export const tacheChecklistSchema = z.object({
  /** Remplacement complet de la liste (ordre conservé) ou bascule d'un seul élément. */
  checklist: z.array(checklistItemSchema).max(50).optional(),
  item_id: z.string().max(40).optional(),
  fait: z.boolean().optional(),
}).refine((v) => v.checklist !== undefined || (v.item_id !== undefined && v.fait !== undefined), "`checklist` ou (`item_id`, `fait`) attendu.");
export type TacheChecklistInput = z.infer<typeof tacheChecklistSchema>;
export const tacheCommentaireSchema = z.object({ contenu: z.string().min(1).max(4000) });
export type TacheCommentaireInput = z.infer<typeof tacheCommentaireSchema>;

export const TRIS_TACHE = ["date_echeance", "priorite", "cree_le", "statut", "titre"] as const;
export const tachesFiltresSchema = z.object({
  statut: z.enum(STATUTS_TACHE).optional(),
  priorite: z.enum(PRIORITES_TACHE).optional(),
  origine: z.enum(ORIGINES_TACHE).optional(),
  assignee_id: uuid.optional(),
  retard: z.enum(["1", "true"]).optional(),
  ouvertes: z.enum(["1", "true"]).optional(),
  q: z.string().min(1).max(100).optional(),
});
export type TachesFiltres = z.infer<typeof tachesFiltresSchema>;
