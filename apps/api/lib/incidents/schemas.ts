/**
 * Schémas Zod des payloads incidents/prestataires — M7 (Master Spec Partie 2.2, Doc A §5).
 * Alignés sur packages/api-contract/openapi.yaml.
 */
import { z } from "zod";

export const CATEGORIES_INCIDENT = [
  "PLOMBERIE",
  "ELECTRICITE",
  "ASCENSEUR",
  "NETTOYAGE",
  "SECURITE",
  "STRUCTURE",
  "JARDINS_ESPACES_VERTS",
  "NUISANCES",
  "PARKING",
  "EQUIPEMENTS_COLLECTIFS",
  "ADMINISTRATIF",
] as const;

export const PARTIES_INCIDENT = ["COMMUNE", "PRIVATIVE"] as const;

export const URGENCES_INCIDENT = ["NORMALE", "URGENTE", "URGENCE_MAXIMALE"] as const;

export const STATUTS_INCIDENT = ["OUVERT", "EN_COURS", "RESOLU", "FERME"] as const;

/**
 * Chemin storage d'une photo d'incident : `<uuid copropriété>/incidents/<nom assaini>`.
 * L'appartenance au tenant courant est re-vérifiée dans le service (défense en profondeur).
 */
const cheminPhotoIncident = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/incidents\/[A-Za-z0-9._-]{1,180}$/i,
    "Chemin de photo invalide."
  );

export const incidentCreateSchema = z.object({
  lot_id: z.string().uuid().nullish(),
  categorie: z.enum(CATEGORIES_INCIDENT),
  sous_categorie: z.string().min(1),
  description: z.string().min(1).nullish(),
  partie: z.enum(PARTIES_INCIDENT),
  urgence: z.enum(URGENCES_INCIDENT),
  photos: z.array(cheminPhotoIncident).max(5).optional(),
  // M15 — « signalement facilité » : nuisance liée au séjour LCD en cours (ou terminé ≤ 7 j).
  sejour_id: z.string().uuid().nullish(),
});
export type IncidentCreateInput = z.infer<typeof incidentCreateSchema>;

export const incidentUploadUrlSchema = z.object({
  nom_fichier: z.string().min(1).max(180),
  content_type: z
    .string()
    .regex(/^image\/(jpeg|png|webp|heic|heif)$/, "Seules les images sont acceptées."),
});
export type IncidentUploadUrlInput = z.infer<typeof incidentUploadUrlSchema>;

export const incidentChangerStatutSchema = z.object({
  statut: z.enum(STATUTS_INCIDENT),
  commentaire: z.string().min(1).nullish(),
});
export type IncidentChangerStatutInput = z.infer<typeof incidentChangerStatutSchema>;

export const incidentAssignerSchema = z.object({
  prestataire_id: z.string().uuid(),
});
export type IncidentAssignerInput = z.infer<typeof incidentAssignerSchema>;

// M16 — fiche fournisseur (Doc A §8.3, §3.6). Le RIB (24 caractères au Maroc) est stocké
// complet mais jamais renvoyé en clair hors GET /prestataires/{id}/rib (audité).
const telephone = z.string().regex(/^\+?[0-9 .-]{8,20}$/, "Téléphone invalide.");
const ficheFournisseur = {
  ice: z.string().regex(/^[0-9]{15}$/, "ICE : 15 chiffres.").nullish(),
  rc: z.string().min(1).max(60).nullish(),
  adresse: z.string().min(1).max(300).nullish(),
  email: z.string().email().max(200).nullish(),
  telephone: telephone.nullish(),
  rib: z.string().regex(/^[0-9]{24}$/, "RIB : 24 chiffres.").nullish(),
  notes: z.string().min(1).max(2000).nullish(),
};

export const prestataireCreateSchema = z.object({
  nom: z.string().min(1),
  specialite: z.string().min(1),
  // `contact` reste accepté (compatibilité clients existants) ; `telephone`/`email` sont les
  // champs structurés M16 — au moins un des trois.
  contact: z.string().min(1).optional(),
  utilisateur_id: z.string().uuid().nullish(),
  ...ficheFournisseur,
}).refine((v) => Boolean(v.contact || v.telephone || v.email), "Fournir un contact (téléphone ou email).");
export type PrestataireCreateInput = z.infer<typeof prestataireCreateSchema>;

/** PATCH /prestataires/:id — fiche (nom, spécialité, contact, fiche fournisseur M16) et activation. */
export const prestataireUpdateSchema = z
  .object({
    nom: z.string().min(1).optional(),
    specialite: z.string().min(1).optional(),
    contact: z.string().min(1).optional(),
    actif: z.boolean().optional(),
    ...ficheFournisseur,
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Aucun champ à modifier.");
export type PrestataireUpdateInput = z.infer<typeof prestataireUpdateSchema>;
