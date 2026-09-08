/** Schémas Zod — M24 Import Excel & onboarding (Doc A §11). */
import { z } from "zod";
import { regexCheminModule } from "../documents/attach";

export const TYPES_IMPORT = ["LOTS_PROPRIETAIRES", "SOLDES_OUVERTURE", "PRESTATAIRES", "CONTRATS", "VEHICULES_BADGES", "PERSONNEL"] as const;
export type TypeImport = (typeof TYPES_IMPORT)[number];
export const STATUTS_IMPORT = ["TELEVERSE", "ANALYSE", "PRET", "EN_COURS", "TERMINE", "ECHOUE", "ANNULE"] as const;

export const importUploadUrlSchema = z.object({
  nom_fichier: z.string().min(1).max(180),
  content_type: z.string().regex(/^(application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel|text\/csv|application\/csv|text\/plain|application\/octet-stream)$/, "Fichier xlsx ou csv attendu."),
});
export type ImportUploadUrlInput = z.infer<typeof importUploadUrlSchema>;

export const importCreateSchema = z.object({
  type: z.enum(TYPES_IMPORT),
  storage_path: z.string().regex(regexCheminModule("import"), "Chemin de fichier hors du périmètre import."),
  nom_fichier: z.string().min(1).max(180),
  /** Options par type (ex. SOLDES_OUVERTURE : date_reference). */
  options: z.object({ date_reference: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), inviter: z.boolean().optional(), canal: z.enum(["SMS", "EMAIL", "WHATSAPP"]).optional() }).optional(),
});
export type ImportCreateInput = z.infer<typeof importCreateSchema>;

export const importMappingSchema = z.object({
  colonnes: z.array(z.object({ index: z.number().int().min(0), champ: z.string().min(1).max(40).nullable() })).min(1).max(60),
  options: z.object({ date_reference: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), inviter: z.boolean().optional(), canal: z.enum(["SMS", "EMAIL", "WHATSAPP"]).optional() }).optional(),
});
export type ImportMappingInput = z.infer<typeof importMappingSchema>;

export const importsFiltresSchema = z.object({ type: z.enum(TYPES_IMPORT).optional(), statut: z.enum(STATUTS_IMPORT).optional() });
export type ImportsFiltres = z.infer<typeof importsFiltresSchema>;

/** POST /invitations/envoyer-en-masse — envoi (ou export du lien) des invitations EN_ATTENTE non encore envoyées. */
export const invitationsMasseSchema = z.object({
  canal: z.enum(["SMS", "EMAIL", "WHATSAPP", "CSV"]),
  invitation_ids: z.array(z.string().uuid()).max(2000).optional(),
  import_job_id: z.string().uuid().optional(),
});
export type InvitationsMasseInput = z.infer<typeof invitationsMasseSchema>;

export const demoCreateSchema = z.object({ nom: z.string().min(1).max(200).optional(), jours: z.number().int().min(1).max(90).optional() });
export type DemoCreateInput = z.infer<typeof demoCreateSchema>;
