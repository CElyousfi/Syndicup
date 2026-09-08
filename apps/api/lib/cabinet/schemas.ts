/** Schémas Zod — M25 Cabinet / portefeuille multi-résidences (Doc A §8). */
import { z } from "zod";

export const ROLES_CABINET = ["CABINET_ADMIN", "CABINET_GESTIONNAIRE", "CABINET_COMPTABLE"] as const;
export type RoleCabinet = (typeof ROLES_CABINET)[number];
const uuid = z.string().uuid();
const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format YYYY-MM-DD.");
const montant = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Montant décimal invalide (ex. "2500.00").');
const telephone = z.string().regex(/^\+?[0-9 .\-()]{8,20}$/, "Téléphone invalide.");

const ficheCabinet = {
  raison_sociale: z.string().max(200).nullish(),
  ice: z.string().regex(/^[0-9]{15}$/, "ICE : 15 chiffres.").nullish(),
  rc: z.string().max(60).nullish(),
  adresse: z.string().max(300).nullish(),
  telephone: telephone.nullish(),
  email: z.string().email().max(200).nullish(),
  parametres: z.object({ seuil_recouvrement: z.number().min(0).max(100).optional(), delai_justificatifs_jours: z.number().int().min(1).max(90).optional() }).nullish(),
};
export const cabinetCreateSchema = z.object({ nom: z.string().min(1).max(200), ...ficheCabinet, admin_utilisateur_id: uuid.nullish() });
export type CabinetCreateInput = z.infer<typeof cabinetCreateSchema>;
export const cabinetUpdateSchema = z.object({ nom: z.string().min(1).max(200).optional(), ...ficheCabinet, statut: z.enum(["ACTIF", "SUSPENDU"]).optional() }).refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type CabinetUpdateInput = z.infer<typeof cabinetUpdateSchema>;

export const membreCreateSchema = z.object({ utilisateur_id: uuid.optional(), telephone: telephone.optional(), email: z.string().email().optional(), role: z.enum(ROLES_CABINET) }).refine((v) => v.utilisateur_id || v.telephone || v.email, "Identifiez le membre (id, téléphone ou e-mail).");
export type MembreCreateInput = z.infer<typeof membreCreateSchema>;
export const membreUpdateSchema = z.object({ role: z.enum(ROLES_CABINET).optional(), actif: z.boolean().optional() }).refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type MembreUpdateInput = z.infer<typeof membreUpdateSchema>;

/** Proposition de mandat sur une copropriété existante (confirmée par son SYNDIC) ou création directe. */
export const mandatCreateSchema = z.object({
  copropriete_id: uuid.optional(),
  nouvelle_copropriete: z.object({ nom: z.string().min(1).max(200), adresse: z.string().min(1).max(500), ville: z.string().min(1).max(100), type_residence: z.enum(["IMMEUBLE_COLLECTIF", "RESIDENCE_FERMEE", "COMPLEXE_MIXTE", "LOTISSEMENT_VILLAS"]).optional(), nb_lots: z.number().int().min(1).max(10000) }).optional(),
  gestionnaire_principal_id: uuid.nullish(),
  date_debut_mandat: dateIso,
  date_fin_mandat: dateIso.nullish(),
  resolution_ag_id: uuid.nullish(),
  honoraires_mensuels: montant.nullish(),
}).refine((v) => Boolean(v.copropriete_id) !== Boolean(v.nouvelle_copropriete), "Indiquez soit une copropriété existante, soit une nouvelle copropriété.");
export type MandatCreateInput = z.infer<typeof mandatCreateSchema>;
export const mandatUpdateSchema = z.object({ gestionnaire_principal_id: uuid.nullish(), date_fin_mandat: dateIso.nullish(), honoraires_mensuels: montant.nullish(), resolution_ag_id: uuid.nullish() }).refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type MandatUpdateInput = z.infer<typeof mandatUpdateSchema>;
export const mandatTerminerSchema = z.object({ date_fin: dateIso.optional(), motif: z.string().max(1000).nullish() });
export type MandatTerminerInput = z.infer<typeof mandatTerminerSchema>;

export const TRIS_PORTEFEUILLE = ["nom", "taux_recouvrement", "impayes_montant", "incidents_ouverts", "taches_retard", "prochaine_ag", "derniere_activite"] as const;
export const portefeuilleFiltresSchema = z.object({ q: z.string().max(60).optional(), alerte: z.enum(["1", "true"]).optional() });
export type PortefeuilleFiltres = z.infer<typeof portefeuilleFiltresSchema>;

export const prestataireModeleSchema = z.object({ nom: z.string().min(1).max(200), specialite: z.string().min(1).max(120), telephone: telephone.nullish(), email: z.string().email().nullish(), ice: z.string().regex(/^[0-9]{15}$/).nullish(), rc: z.string().max(60).nullish(), adresse: z.string().max(300).nullish(), notes: z.string().max(2000).nullish() });
export type PrestataireModeleInput = z.infer<typeof prestataireModeleSchema>;
export const prestataireCopierSchema = z.object({ copropriete_id: uuid });
