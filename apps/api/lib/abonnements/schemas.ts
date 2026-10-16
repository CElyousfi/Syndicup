/** Schémas Zod — M29 Abonnements & console opérateur. */
import { z } from "zod";

const uuid = z.string().uuid();
const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format YYYY-MM-DD.");
const montant = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Montant décimal invalide (ex. "9.90").');
const telephone = z.string().regex(/^\+?[0-9 .\-()]{8,20}$/, "Téléphone invalide.");
const texte = (max: number) => z.string().trim().max(max);

export const FORMULES = ["ESSENTIEL", "STANDARD", "PRESTIGE", "CABINET"] as const;
export const PERIODICITES = ["ANNUELLE", "MENSUELLE"] as const;
export const MODES_PAIEMENT = ["VIREMENT", "CHEQUE", "ESPECES", "CARTE", "AUTRE"] as const;

const ficheClient = {
  raison_sociale: texte(200).nullish(),
  ice: z.string().regex(/^[0-9]{15}$/, "ICE : 15 chiffres.").nullish(),
  rc: texte(60).nullish(),
  identifiant_fiscal: texte(60).nullish(),
  adresse: texte(300).nullish(),
  ville: texte(100).nullish(),
  contact_nom: texte(200).nullish(),
  contact_email: z.string().trim().email("E-mail invalide.").max(200).nullish(),
  contact_telephone: telephone.nullish(),
  cabinet_id: uuid.nullish(),
  notes: texte(2000).nullish(),
};

export const clientCreateSchema = z.object({
  type: z.enum(["SYNDICAT", "CABINET"]),
  nom: texte(200).min(1, "Nom requis."),
  ...ficheClient,
});
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;

export const clientUpdateSchema = z
  .object({ nom: texte(200).min(1).optional(), ...ficheClient })
  .refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

/** Ouverture d'un abonnement : client existant OU nouveau client, résidences couvertes, prix figé. */
export const abonnementCreateSchema = z
  .object({
    client_id: uuid.optional(),
    nouveau_client: clientCreateSchema.optional(),
    copropriete_ids: z.array(uuid).min(1, "Au moins une résidence.").max(500),
    formule: z.enum(FORMULES),
    periodicite: z.enum(PERIODICITES).default("ANNUELLE"),
    lots_contractes: z.number().int().min(1).max(100000),
    /** Absents = prix de la grille (tarifs.ts). */
    prix_lot: montant.optional(),
    minimum_mensuel: montant.nullish(),
    taux_tva: montant.optional(),
    tarif_fondateur: z.boolean().default(false),
    forfait_accompagne: montant.nullish(),
    date_debut: dateIso,
    /** Essai gratuit : true = 30 jours à partir de date_debut (ou `fin_essai` si fournie). */
    essai: z.boolean().default(true),
    fin_essai: dateIso.optional(),
    /** Sans essai : abonnement directement ACTIF, payé jusqu'à cette date (sinon : à facturer). */
    fin_periode: dateIso.optional(),
    delai_grace_jours: z.number().int().min(0).max(90).optional(),
    notes: texte(2000).nullish(),
  })
  .refine((v) => Boolean(v.client_id) !== Boolean(v.nouveau_client), "Indiquez soit un client existant, soit un nouveau client.");
export type AbonnementCreateInput = z.infer<typeof abonnementCreateSchema>;

export const abonnementUpdateSchema = z
  .object({
    formule: z.enum(FORMULES).optional(),
    periodicite: z.enum(PERIODICITES).optional(),
    lots_contractes: z.number().int().min(1).max(100000).optional(),
    prix_lot: montant.optional(),
    minimum_mensuel: montant.nullable().optional(),
    taux_tva: montant.optional(),
    tarif_fondateur: z.boolean().optional(),
    prix_garanti_jusqu_au: dateIso.nullable().optional(),
    forfait_accompagne: montant.nullable().optional(),
    delai_grace_jours: z.number().int().min(0).max(90).optional(),
    notes: texte(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type AbonnementUpdateInput = z.infer<typeof abonnementUpdateSchema>;

/** Actions de cycle de vie — une seule route, union discriminée. */
export const abonnementActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("PROLONGER_ESSAI"), fin_essai: dateIso, motif: texte(500).optional() }),
  z.object({ action: z.literal("ACCORDER_DELAI"), jusqu_au: dateIso, motif: texte(500).min(1, "Motif requis (ex. vote en AG le …).") }),
  z.object({ action: z.literal("RETIRER_DELAI") }),
  z.object({ action: z.literal("ACTIVER"), fin_periode: dateIso, motif: texte(500).optional() }),
  z.object({ action: z.literal("SUSPENDRE"), motif: texte(500).min(1, "Motif requis.") }),
  z.object({ action: z.literal("REACTIVER"), motif: texte(500).optional() }),
  z.object({ action: z.literal("RESILIER"), motif: texte(500).min(1, "Motif requis.") }),
]);
export type AbonnementActionInput = z.infer<typeof abonnementActionSchema>;

export const rattacherCoproprieteSchema = z.object({ copropriete_id: uuid });

export const factureCreateSchema = z.object({
  /** Début de la période facturée — défaut : lendemain de la période payée (ou de la fin d'essai). */
  periode_debut: dateIso.optional(),
  /** Lots facturés — défaut : max(lots contractés, lots réellement créés dans les résidences). */
  lots: z.number().int().min(1).max(100000).optional(),
  echeance_jours: z.number().int().min(0).max(90).default(15),
  lignes_supplementaires: z.array(z.object({ libelle: texte(200).min(1), montant })).max(10).optional(),
});
export type FactureCreateInput = z.infer<typeof factureCreateSchema>;

export const paiementCreateSchema = z.object({
  montant,
  mode: z.enum(MODES_PAIEMENT),
  reference: texte(120).nullish(),
  recu_le: dateIso,
});
export type PaiementCreateInput = z.infer<typeof paiementCreateSchema>;

export const factureAnnulerSchema = z.object({ motif: texte(500).min(1, "Motif requis.") });

export const tarifQuerySchema = z.object({
  formule: z.enum(FORMULES),
  lots: z.coerce.number().int().min(1).max(100000),
  periodicite: z.enum(PERIODICITES).default("ANNUELLE"),
  fondateur: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
});

export const utilisateurStatutSchema = z.object({
  statut_compte: z.enum(["ACTIF", "SUSPENDU"]),
  motif: texte(500).optional(),
});
