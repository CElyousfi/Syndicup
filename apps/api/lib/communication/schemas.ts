/**
 * Schémas Zod — M21 Communication (annonces, sondages, contacts utiles ; Doc A §8, §12).
 * Contenu Markdown restreint, assaini côté API (`sanitize.ts`) ; audiences fermées ; dates ISO.
 */
import { z } from "zod";
import { regexCheminModule } from "../documents/attach";

export const CATEGORIES_ANNONCE = ["INFORMATION", "TRAVAUX", "COUPURE", "SECURITE", "URGENCE", "AG", "CONVIVIALITE", "REGLEMENT"] as const;
export type CategorieAnnonce = (typeof CATEGORIES_ANNONCE)[number];
export const AUDIENCES = ["TOUS", "PROPRIETAIRES", "OCCUPANTS", "CONSEIL", "BATIMENT"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const STATUTS_ANNONCE = ["BROUILLON", "PUBLIEE", "ARCHIVEE"] as const;
export const STATUTS_SONDAGE = ["BROUILLON", "OUVERT", "CLOS"] as const;
export const CANAUX_PREFERENCE = ["PUSH", "EMAIL", "SMS", "AUCUN"] as const;

const uuid = z.string().uuid();
const dateHeure = z.string().datetime({ offset: true });
const batiment = z.string().min(1).max(40);

export const pieceAnnonceSchema = z.object({
  storage_path: z.string().regex(regexCheminModule("communication"), "Chemin de fichier invalide."),
  nom: z.string().min(1).max(200),
});
export const communicationUploadUrlSchema = z.object({
  nom_fichier: z.string().min(1).max(180),
  content_type: z.string().regex(/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/, "Image ou PDF uniquement."),
});
export type CommunicationUploadUrlInput = z.infer<typeof communicationUploadUrlSchema>;

const audienceRefine = <T extends { audience?: string; batiment?: string | null }>(v: T) => v.audience !== "BATIMENT" || Boolean(v.batiment);

const annonceBase = {
  titre: z.string().min(1).max(200),
  contenu: z.string().min(1).max(20000),
  categorie: z.enum(CATEGORIES_ANNONCE),
  audience: z.enum(AUDIENCES).default("TOUS"),
  batiment: batiment.nullish(),
  epingle: z.boolean().default(false),
  expire_le: dateHeure.nullish(),
  commentaires_actives: z.boolean().default(true),
  pieces_jointes: z.array(pieceAnnonceSchema).max(10).default([]),
};
export const annonceCreateSchema = z.object(annonceBase).refine(audienceRefine, { message: "`batiment` est requis pour l'audience BATIMENT.", path: ["batiment"] });
export type AnnonceCreateInput = z.infer<typeof annonceCreateSchema>;
export const annonceUpdateSchema = z
  .object({ ...annonceBase, audience: z.enum(AUDIENCES), epingle: z.boolean(), commentaires_actives: z.boolean(), pieces_jointes: z.array(pieceAnnonceSchema).max(10) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type AnnonceUpdateInput = z.infer<typeof annonceUpdateSchema>;
export const annoncePublierSchema = z.object({
  /** Publication différée (ISO) — sinon immédiate. */
  publie_le: dateHeure.nullish(),
});
export type AnnoncePublierInput = z.infer<typeof annoncePublierSchema>;
export const TRIS_ANNONCE = ["publie_le", "cree_le", "titre", "categorie"] as const;
export const annoncesFiltresSchema = z.object({
  categorie: z.enum(CATEGORIES_ANNONCE).optional(),
  statut: z.enum(STATUTS_ANNONCE).optional(),
  audience: z.enum(AUDIENCES).optional(),
  non_lues: z.enum(["1", "true"]).optional(),
  q: z.string().min(1).max(100).optional(),
});
export type AnnoncesFiltres = z.infer<typeof annoncesFiltresSchema>;

export const commentaireCreateSchema = z.object({ contenu: z.string().min(1).max(2000) });
export type CommentaireCreateInput = z.infer<typeof commentaireCreateSchema>;

const optionSondage = z.object({ id: z.string().regex(/^[a-z0-9_-]{1,40}$/i).optional(), libelle: z.string().min(1).max(200) });
const sondageBase = {
  question: z.string().min(1).max(300),
  description: z.string().max(4000).nullish(),
  options: z.array(optionSondage).min(2).max(10),
  choix_multiple: z.boolean().default(false),
  anonyme: z.boolean().default(true),
  audience: z.enum(AUDIENCES).default("TOUS"),
  batiment: batiment.nullish(),
  ponderation_tantiemes: z.boolean().default(false),
  date_fin: dateHeure,
};
export const sondageCreateSchema = z.object(sondageBase).refine(audienceRefine, { message: "`batiment` est requis pour l'audience BATIMENT.", path: ["batiment"] });
export type SondageCreateInput = z.infer<typeof sondageCreateSchema>;
export const sondageUpdateSchema = z
  .object({ ...sondageBase, choix_multiple: z.boolean(), anonyme: z.boolean(), audience: z.enum(AUDIENCES), ponderation_tantiemes: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type SondageUpdateInput = z.infer<typeof sondageUpdateSchema>;
export const sondageRepondreSchema = z.object({ choix: z.array(z.string().min(1).max(40)).min(1).max(10) });
export type SondageRepondreInput = z.infer<typeof sondageRepondreSchema>;
export const sondagesFiltresSchema = z.object({ statut: z.enum(STATUTS_SONDAGE).optional(), q: z.string().min(1).max(100).optional() });
export type SondagesFiltres = z.infer<typeof sondagesFiltresSchema>;
export const TRIS_SONDAGE = ["date_fin", "cree_le", "question"] as const;

export const contactUtileSchema = z.object({
  libelle: z.string().min(1).max(120),
  telephone: z.string().regex(/^\+?[0-9 ().-]{2,30}$/, "Numéro invalide."),
  ordre: z.number().int().min(0).max(999).default(0),
});
export type ContactUtileInput = z.infer<typeof contactUtileSchema>;
export const contactUtileUpdateSchema = contactUtileSchema.partial().refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type ContactUtileUpdateInput = z.infer<typeof contactUtileUpdateSchema>;

/** Préférences de notification (Utilisateur) — M21, respectées par le digest hebdomadaire. */
const heureHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure au format HH:MM.");
export const preferencesNotificationSchema = z.object({
  digest_hebdo: z.boolean().default(true),
  canal_digest: z.enum(CANAUX_PREFERENCE).default("EMAIL"),
  annonces_push: z.boolean().default(true),
  // Push par niveau (push-niveaux.ts) : URGENT n'est jamais désactivable.
  push_normal: z.boolean().default(true),
  push_info: z.boolean().default(true),
  push_son: z.boolean().default(true),
  /** Heures calmes (heure de Casablanca) : NORMAL / INFO livrés sans son ni réveil de l'écran. */
  heures_calmes: z.object({ debut: heureHHMM, fin: heureHHMM }).nullable().default(null),
});
export type PreferencesNotification = z.infer<typeof preferencesNotificationSchema>;
export const PREFERENCES_DEFAUT: PreferencesNotification = { digest_hebdo: true, canal_digest: "EMAIL", annonces_push: true, push_normal: true, push_info: true, push_son: true, heures_calmes: null };
export { uuid as uuidSchema };
