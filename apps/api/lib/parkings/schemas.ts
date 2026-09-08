/** Schémas Zod — M23 Parkings et caves (Doc A §4) : emplacements, attributions, véhicules, badges, places visiteurs. */
import { z } from "zod";

export const TYPES_EMPLACEMENT = ["PARKING_COMMUN", "PARKING_VISITEUR", "PARKING_PMR", "MOTO", "VELO", "CAVE_COMMUNE"] as const;
export const STATUTS_EMPLACEMENT = ["DISPONIBLE", "ATTRIBUE", "HORS_SERVICE"] as const;
export const TYPES_ATTRIBUTION = ["ATTRIBUTION_AG", "ROTATION", "LOCATION_INTERNE", "TEMPORAIRE"] as const;
export const TYPES_VEHICULE = ["VOITURE", "MOTO", "UTILITAIRE"] as const;
export const TYPES_BADGE = ["BADGE_PIETON", "TELECOMMANDE_PARKING", "CLE_CAVE", "CARTE_ASCENSEUR"] as const;
export const STATUTS_BADGE = ["ACTIF", "PERDU", "DESACTIVE", "RESTITUE"] as const;

const uuid = z.string().uuid();
const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format YYYY-MM-DD.");
const montant = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Montant décimal invalide (ex. "150.00").');
/** Plaque : lettres / chiffres / tirets, normalisée en majuscules sans espaces (« 12345-A-6 », « WW-123456 »). */
export const immatriculationSchema = z.string().min(2).max(24).transform((v) => normaliserImmatriculation(v)).refine((v) => /^[A-Z0-9-]{2,20}$/.test(v), "Immatriculation invalide (lettres, chiffres, tirets).");
export function normaliserImmatriculation(v: string): string {
  return v.toUpperCase().replace(/[\s._/]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").replace(/[^A-Z0-9-]/g, "");
}

export const emplacementCreateSchema = z.object({
  type: z.enum(TYPES_EMPLACEMENT),
  code: z.string().min(1).max(30),
  niveau: z.string().min(1).max(30).nullish(),
  attribuable: z.boolean().default(true),
  notes: z.string().max(2000).nullish(),
});
export type EmplacementCreateInput = z.infer<typeof emplacementCreateSchema>;
export const emplacementUpdateSchema = z.object({
  type: z.enum(TYPES_EMPLACEMENT).optional(),
  code: z.string().min(1).max(30).optional(),
  niveau: z.string().min(1).max(30).nullish(),
  attribuable: z.boolean().optional(),
  statut: z.enum(["DISPONIBLE", "HORS_SERVICE"]).optional(),
  notes: z.string().max(2000).nullish(),
}).refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type EmplacementUpdateInput = z.infer<typeof emplacementUpdateSchema>;
export const TRIS_EMPLACEMENT = ["code", "niveau", "type", "statut"] as const;
export const emplacementsFiltresSchema = z.object({
  type: z.enum(TYPES_EMPLACEMENT).optional(),
  niveau: z.string().min(1).max(30).optional(),
  statut: z.enum(STATUTS_EMPLACEMENT).optional(),
  q: z.string().min(1).max(60).optional(),
});
export type EmplacementsFiltres = z.infer<typeof emplacementsFiltresSchema>;

export const attribuerSchema = z.object({
  lot_id: uuid,
  type: z.enum(TYPES_ATTRIBUTION),
  date_debut: dateIso,
  date_fin: dateIso.nullish(),
  resolution_ag_id: uuid.nullish(),
  redevance_mensuelle: montant.nullish(),
  notes: z.string().max(2000).nullish(),
}).refine((v) => !v.date_fin || v.date_fin >= v.date_debut, { message: "`date_fin` doit suivre `date_debut`.", path: ["date_fin"] })
  .refine((v) => v.type !== "TEMPORAIRE" || Boolean(v.date_fin), { message: "Une attribution TEMPORAIRE a une date de fin.", path: ["date_fin"] });
export type AttribuerInput = z.infer<typeof attribuerSchema>;
/** `date_fin` = dernier jour d'occupation (inclus) ; absent = la place est libre dès aujourd'hui. */
export const libererSchema = z.object({ date_fin: dateIso.optional(), motif: z.string().max(1000).nullish() });
export type LibererInput = z.infer<typeof libererSchema>;

export const vehiculeCreateSchema = z.object({
  lot_id: uuid,
  immatriculation: immatriculationSchema,
  marque: z.string().max(60).nullish(),
  couleur: z.string().max(40).nullish(),
  type: z.enum(TYPES_VEHICULE).default("VOITURE"),
});
export type VehiculeCreateInput = z.infer<typeof vehiculeCreateSchema>;
export const vehiculeUpdateSchema = z.object({
  immatriculation: immatriculationSchema.optional(),
  marque: z.string().max(60).nullish(),
  couleur: z.string().max(40).nullish(),
  type: z.enum(TYPES_VEHICULE).optional(),
  actif: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type VehiculeUpdateInput = z.infer<typeof vehiculeUpdateSchema>;
export const vehiculesFiltresSchema = z.object({ lot_id: uuid.optional(), actif: z.enum(["1", "0", "true", "false"]).optional(), q: z.string().min(1).max(30).optional() });
export type VehiculesFiltres = z.infer<typeof vehiculesFiltresSchema>;
export const rechercheSchema = z.object({ immatriculation: z.string().min(2).max(24) });

export const badgeCreateSchema = z.object({
  lot_id: uuid,
  type: z.enum(TYPES_BADGE),
  identifiant: z.string().min(1).max(60),
  remis_le: dateIso,
  caution_montant: montant.nullish(),
  caution_paiement_id: uuid.nullish(),
  notes: z.string().max(2000).nullish(),
});
export type BadgeCreateInput = z.infer<typeof badgeCreateSchema>;
export const badgeUpdateSchema = z.object({
  identifiant: z.string().min(1).max(60).optional(),
  caution_montant: montant.nullish(),
  caution_paiement_id: uuid.nullish(),
  notes: z.string().max(2000).nullish(),
}).refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type BadgeUpdateInput = z.infer<typeof badgeUpdateSchema>;
export const badgesFiltresSchema = z.object({ lot_id: uuid.optional(), type: z.enum(TYPES_BADGE).optional(), statut: z.enum(STATUTS_BADGE).optional() });
export type BadgesFiltres = z.infer<typeof badgesFiltresSchema>;
export const badgeRestituerSchema = z.object({ restitue_le: dateIso.optional(), caution_rendue: z.boolean().default(true) });
export type BadgeRestituerInput = z.infer<typeof badgeRestituerSchema>;
export const badgePerduSchema = z.object({ commentaire: z.string().max(1000).nullish(), creer_tache: z.boolean().default(true) });
export type BadgePerduInput = z.infer<typeof badgePerduSchema>;

/** POST /visites/{id}/emplacement — le gardien attribue une place visiteur (plaque, heure limite). */
export const visiteEmplacementSchema = z.object({
  emplacement_id: uuid.nullable(),
  immatriculation: immatriculationSchema.nullish(),
  heure_limite: z.string().datetime({ offset: true }).nullish(),
});
export type VisiteEmplacementInput = z.infer<typeof visiteEmplacementSchema>;
/** POST /incidents/{id}/notifier-vehicule — le gardien identifie la plaque et prévient le lot. */
export const notifierVehiculeSchema = z.object({ immatriculation: immatriculationSchema.optional(), message: z.string().max(500).nullish() });
export type NotifierVehiculeInput = z.infer<typeof notifierVehiculeSchema>;
