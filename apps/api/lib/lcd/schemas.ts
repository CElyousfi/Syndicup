/**
 * Schémas Zod — M15 Location courte durée (Doc A §10.2). Validation stricte de chaque payload
 * (CLAUDE.md §1.5) : aucun défaut deviné sur un champ sensible, données voyageur minimales
 * (CNDP : jamais de numéro de pièce complet, 4 caractères maximum).
 */
import { z } from "zod";

export const REGIMES_LCD = ["NON_DEFINI", "AUTORISEE", "ENCADREE", "INTERDITE"] as const;
export const STATUTS_DECLARATION_LCD = ["EN_ATTENTE", "VALIDEE", "REFUSEE", "SUSPENDUE", "CLOTUREE"] as const;
export const STATUTS_SEJOUR = ["PREVU", "EN_COURS", "TERMINE", "ANNULE"] as const;
export const TYPES_PIECE_IDENTITE = ["CIN", "PASSEPORT", "TITRE_SEJOUR", "AUTRE"] as const;

const uuid = z.string().uuid();
const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format YYYY-MM-DD.");
const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue au format HH:mm.");
const telephone = z.string().regex(/^\+?[0-9 ]{8,20}$/, "Téléphone invalide.");

/**
 * Paramètres du régime ENCADREE — tous nullable en base (valeurs de règlement propres à chaque
 * copropriété, jamais devinées). `null` = limite non configurée = règle non appliquée, sauf les
 * deux booléens qui doivent être explicites.
 */
export const parametresLcdSchema = z
  .object({
    declaration_prealable_obligatoire: z.boolean(),
    delai_declaration_heures: z.number().int().min(0).max(24 * 30).nullable(),
    nb_nuits_max_par_an: z.number().int().min(1).max(366).nullable(),
    nb_voyageurs_max_par_lot: z.number().int().min(1).max(50).nullable(),
    gestionnaire_obligatoire_si_proprietaire_absent: z.boolean(),
    contact_gardien_obligatoire: z.boolean(),
  })
  .strict();
export type ParametresLcd = z.infer<typeof parametresLcdSchema>;

export const reglementLcdUpdateSchema = z
  .object({
    regime_lcd: z.enum(REGIMES_LCD),
    parametres_lcd_json: parametresLcdSchema.nullish(),
    ag_resolution_id: uuid.nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.regime_lcd === "ENCADREE" && !v.parametres_lcd_json) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parametres_lcd_json"],
        message: "Paramètres obligatoires pour le régime ENCADREE.",
      });
    }
  });
export type ReglementLcdUpdateInput = z.infer<typeof reglementLcdUpdateSchema>;

const plateformes = z.array(z.string().min(1).max(60)).max(10);

export const declarationLcdCreateSchema = z.object({
  lot_id: uuid,
  gestionnaire_id: uuid.nullish(),
  plateformes: plateformes.nullish(),
  contact_urgence_nom: z.string().min(1).max(120).nullish(),
  contact_urgence_telephone: telephone.nullish(),
  date_debut: dateIso.optional(),
});
export type DeclarationLcdCreateInput = z.infer<typeof declarationLcdCreateSchema>;

export const declarationLcdUpdateSchema = z
  .object({
    plateformes: plateformes.nullish(),
    contact_urgence_nom: z.string().min(1).max(120).nullish(),
    contact_urgence_telephone: telephone.nullish(),
    gestionnaire_id: uuid.nullish(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Aucun champ à modifier.");
export type DeclarationLcdUpdateInput = z.infer<typeof declarationLcdUpdateSchema>;

export const declarationLcdDecisionSchema = z
  .object({
    decision: z.enum(["VALIDEE", "REFUSEE", "SUSPENDUE"]),
    motif: z.string().min(1).max(1000).nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.decision !== "VALIDEE" && !v.motif) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["motif"], message: "Motif obligatoire pour un refus ou une suspension." });
    }
  });
export type DeclarationLcdDecisionInput = z.infer<typeof declarationLcdDecisionSchema>;

export const declarationLcdClotureSchema = z.object({
  date_fin: dateIso.optional(),
});
export type DeclarationLcdClotureInput = z.infer<typeof declarationLcdClotureSchema>;

/**
 * Désignation d'un gestionnaire : soit un compte connu (`utilisateur_id`), soit une personne à
 * inviter (email et/ou téléphone → invitation M2 GESTIONNAIRE_LCD sur le lot).
 */
export const declarationLcdGestionnaireSchema = z
  .object({
    utilisateur_id: uuid.nullish(),
    email: z.string().email().max(200).nullish(),
    telephone: telephone.nullish(),
    canal: z.enum(["EMAIL", "SMS", "WHATSAPP", "QR_CODE"]).default("SMS"),
  })
  .refine((v) => Boolean(v.utilisateur_id || v.email || v.telephone), "utilisateur_id, email ou telephone requis.");
export type DeclarationLcdGestionnaireInput = z.infer<typeof declarationLcdGestionnaireSchema>;

/** Chemin storage d'une pièce jointe de séjour : `<copropriete>/lcd/sejours/<fichier>`. */
export const cheminPieceJointeSejour = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/lcd\/sejours\/[A-Za-z0-9._-]{1,180}$/i, "Chemin de pièce jointe invalide.");
export const MAX_PIECES_JOINTES_SEJOUR = 10;

export const sejourUploadUrlSchema = z.object({
  nom_fichier: z.string().min(1).max(180),
  // Images (photo prise ou choisie) et PDF (confirmation de réservation). Jamais de scan de
  // pièce d'identité : le libellé côté client le rappelle, la minimisation CNDP l'impose.
  content_type: z.string().regex(/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/, "Image ou PDF uniquement."),
});
export type SejourUploadUrlInput = z.infer<typeof sejourUploadUrlSchema>;

export const sejourPiecesJointesSchema = z.object({
  chemins: z.array(cheminPieceJointeSejour).min(1).max(MAX_PIECES_JOINTES_SEJOUR),
});
export type SejourPiecesJointesInput = z.infer<typeof sejourPiecesJointesSchema>;

export const sejourPieceJointeSupprimerSchema = z.object({ chemin: cheminPieceJointeSejour });
export type SejourPieceJointeSupprimerInput = z.infer<typeof sejourPieceJointeSupprimerSchema>;

const sejourBase = {
  date_arrivee: dateIso,
  date_depart: dateIso,
  heure_arrivee_prevue: heure.nullish(),
  nb_voyageurs: z.number().int().min(1).max(50),
  voyageur_principal_nom: z.string().min(1).max(120),
  voyageur_telephone: telephone.nullish(),
  voyageur_nationalite: z.string().regex(/^[A-Za-z]{2,3}$/, "Code pays ISO attendu (ex. MA, FR).").nullish(),
  piece_identite_type: z.enum(TYPES_PIECE_IDENTITE).nullish(),
  // Jamais le numéro complet (CNDP) : 4 derniers caractères au plus.
  piece_identite_fin: z.string().regex(/^[A-Za-z0-9]{1,4}$/, "4 caractères alphanumériques au plus.").nullish(),
  plaque_vehicule: z.string().min(1).max(20).nullish(),
  pieces_jointes: z.array(cheminPieceJointeSejour).max(MAX_PIECES_JOINTES_SEJOUR).optional(),
};

function datesCoherentes(v: { date_arrivee?: string; date_depart?: string }, ctx: z.RefinementCtx) {
  if (v.date_arrivee && v.date_depart && v.date_depart <= v.date_arrivee) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date_depart"], message: "La date de départ doit être postérieure à l'arrivée." });
  }
}

export const sejourCreateSchema = z
  .object({ lot_id: uuid, ...sejourBase })
  .superRefine(datesCoherentes);
export type SejourCreateInput = z.infer<typeof sejourCreateSchema>;

export const sejourUpdateSchema = z
  .object({
    date_arrivee: dateIso.optional(),
    date_depart: dateIso.optional(),
    heure_arrivee_prevue: heure.nullish(),
    nb_voyageurs: z.number().int().min(1).max(50).optional(),
    voyageur_principal_nom: z.string().min(1).max(120).optional(),
    voyageur_telephone: telephone.nullish(),
    voyageur_nationalite: sejourBase.voyageur_nationalite,
    piece_identite_type: z.enum(TYPES_PIECE_IDENTITE).nullish(),
    piece_identite_fin: sejourBase.piece_identite_fin,
    plaque_vehicule: z.string().min(1).max(20).nullish(),
    pieces_jointes: z.array(cheminPieceJointeSejour).max(MAX_PIECES_JOINTES_SEJOUR).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Aucun champ à modifier.")
  .superRefine(datesCoherentes);
export type SejourUpdateInput = z.infer<typeof sejourUpdateSchema>;

export const sejourAnnulerSchema = z.object({
  motif: z.string().min(1).max(500).nullish(),
});
export type SejourAnnulerInput = z.infer<typeof sejourAnnulerSchema>;

export const sejourArriveeSchema = z.object({
  nb_voyageurs_constate: z.number().int().min(0).max(50).nullish(),
});
export type SejourArriveeInput = z.infer<typeof sejourArriveeSchema>;

export const declarationsFiltresSchema = z.object({
  lot_id: uuid.optional(),
  statut: z.enum(STATUTS_DECLARATION_LCD).optional(),
});
export type DeclarationsFiltres = z.infer<typeof declarationsFiltresSchema>;

export const sejoursFiltresSchema = z.object({
  lot_id: uuid.optional(),
  statut: z.enum(STATUTS_SEJOUR).optional(),
  date_from: dateIso.optional(),
  date_to: dateIso.optional(),
});
export type SejoursFiltres = z.infer<typeof sejoursFiltresSchema>;
