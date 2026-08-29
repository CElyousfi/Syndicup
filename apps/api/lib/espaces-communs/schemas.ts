/**
 * Schémas Zod des payloads parties communes — M8 (Master Spec Partie 2.2/9.4, Doc A §7).
 */
import { z } from "zod";

export const espaceCommunCreateSchema = z.object({
  nom: z.string().min(1),
  type: z.string().min(1),
  capacite: z.number().int().positive().nullish(),
  reservable: z.boolean().optional(),
  validation_automatique: z.boolean().optional(),
  regles_reservation_json: z.record(z.unknown()).nullish(),
});
export type EspaceCommunCreateInput = z.infer<typeof espaceCommunCreateSchema>;

/** PATCH /espaces-communs/:id — tous les champs facultatifs, au moins un requis. */
export const espaceCommunUpdateSchema = espaceCommunCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type EspaceCommunUpdateInput = z.infer<typeof espaceCommunUpdateSchema>;

export const reservationCreateSchema = z
  .object({
    espace_id: z.string().uuid(),
    lot_id: z.string().uuid(),
    date_debut: z.string().datetime(),
    date_fin: z.string().datetime(),
    nombre_invites: z.number().int().min(0).nullish(),
  })
  .superRefine((val, ctx) => {
    if (new Date(val.date_fin).getTime() <= new Date(val.date_debut).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date_fin"],
        message: "date_fin doit être postérieure à date_debut.",
      });
    }
  });
export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>;

export const reservationRejeterSchema = z.object({
  motif: z.string().min(1),
});
export type ReservationRejeterInput = z.infer<typeof reservationRejeterSchema>;
