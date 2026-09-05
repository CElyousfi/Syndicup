/**
 * Schémas Zod — M18 Rapports (Doc A §8 reddition des comptes, §6 approbation des comptes, §3.5
 * transparence). Exercice = année civile « YYYY » ; langue des PDF fr | ar.
 */
import { z } from "zod";

export const STATUTS_RAPPORT_GESTION = ["BROUILLON", "GENERE", "SOUMIS_AG", "APPROUVE", "REJETE"] as const;
export const TYPES_MAJORITE_AG = ["SIMPLE", "DOUBLE", "UNANIMITE"] as const;
export const LANGUES_PDF = ["fr", "ar"] as const;
export type LanguePdf = (typeof LANGUES_PDF)[number];

const uuid = z.string().uuid();
export const exercice = z.string().regex(/^\d{4}$/, 'Exercice invalide (format "YYYY").');

export const exerciceQuerySchema = z.object({ exercice: exercice.optional() });
export type ExerciceQuery = z.infer<typeof exerciceQuerySchema>;

export const languePdfQuerySchema = z.object({ langue: z.enum(LANGUES_PDF).default("fr") });

export const rapportGestionCreateSchema = z.object({
  exercice,
  budget_ag_id: uuid.nullish(),
});
export type RapportGestionCreateInput = z.infer<typeof rapportGestionCreateSchema>;

export const rapportsGestionFiltresSchema = z.object({
  statut: z.enum(STATUTS_RAPPORT_GESTION).optional(),
  exercice: exercice.optional(),
});
export type RapportsGestionFiltres = z.infer<typeof rapportsGestionFiltresSchema>;
export const TRIS_RAPPORT = ["exercice", "genere_le", "statut"] as const;

/**
 * Soumission à l'AG : `type_majorite` explicite ou lu dans `copropriete.config_json.majorite_approbation_comptes`
 * — jamais deviné (LEGAL_QUESTIONS_BRIEF §9 : la majorité requise pour approuver les comptes n'est pas
 * confirmée) → 422 RAPPORT_PARAMETRE_NON_CONFIGURE si absent des deux côtés.
 */
export const rapportSoumettreAgSchema = z.object({
  ag_id: uuid,
  type_majorite: z.enum(TYPES_MAJORITE_AG).optional(),
});
export type RapportSoumettreAgInput = z.infer<typeof rapportSoumettreAgSchema>;

export const transparenceQuerySchema = z.object({
  exercice: exercice.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const facturesVisiblesSchema = z.object({ factures_visibles_residents: z.boolean() });
export type FacturesVisiblesInput = z.infer<typeof facturesVisiblesSchema>;

export const impayesFiltresSchema = z.object({
  tranche: z.enum(["0_30", "31_90", "91_180", "PLUS_180"]).optional(),
  lot_id: uuid.optional(),
});
export type ImpayesFiltres = z.infer<typeof impayesFiltresSchema>;
export const TRIS_IMPAYES = ["retard_jours", "reste_du", "date_echeance", "lot"] as const;

export const releveQuerySchema = z.object({ exercice: exercice.optional(), langue: z.enum(LANGUES_PDF).default("fr") });
