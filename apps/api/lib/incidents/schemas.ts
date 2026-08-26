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

export const incidentCreateSchema = z.object({
  lot_id: z.string().uuid().nullish(),
  categorie: z.enum(CATEGORIES_INCIDENT),
  sous_categorie: z.string().min(1),
  description: z.string().min(1).nullish(),
  partie: z.enum(PARTIES_INCIDENT),
  urgence: z.enum(URGENCES_INCIDENT),
});
export type IncidentCreateInput = z.infer<typeof incidentCreateSchema>;

export const incidentChangerStatutSchema = z.object({
  statut: z.enum(STATUTS_INCIDENT),
  commentaire: z.string().min(1).nullish(),
});
export type IncidentChangerStatutInput = z.infer<typeof incidentChangerStatutSchema>;

export const incidentAssignerSchema = z.object({
  prestataire_id: z.string().uuid(),
});
export type IncidentAssignerInput = z.infer<typeof incidentAssignerSchema>;

export const prestataireCreateSchema = z.object({
  nom: z.string().min(1),
  specialite: z.string().min(1),
  contact: z.string().min(1),
  utilisateur_id: z.string().uuid().nullish(),
});
export type PrestataireCreateInput = z.infer<typeof prestataireCreateSchema>;
