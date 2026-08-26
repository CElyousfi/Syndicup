/**
 * Schémas Zod — M10 Personnel / gardien & visites (Master Spec Partie 2.2/13.3, Doc A §9).
 */
import { z } from "zod";

export const personnelCreateSchema = z.object({
  utilisateur_id: z.string().uuid(),
  statut: z.enum(["PRESENT", "ABSENT", "REMPLACE"]).optional(),
  logement_lot_id: z.string().uuid().nullable().optional(),
});
export type PersonnelCreateInput = z.infer<typeof personnelCreateSchema>;

export const personnelChangerStatutSchema = z.object({
  statut: z.enum(["PRESENT", "ABSENT", "REMPLACE"]),
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
