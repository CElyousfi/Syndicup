import { z } from "zod";

export const langueSchema = z.enum(["fr", "ar"]);

/** GET /assistant?langue=fr|ar */
export const assistantQuerySchema = z.object({
  langue: langueSchema.default("fr"),
});

/** POST /assistant/messages — l'historique court de la conversation (le serveur ne stocke rien). */
export const assistantMessagesSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          contenu: z.string().trim().min(1).max(2000),
        })
      )
      .min(1)
      .max(12),
    /** Chemin de l'écran ouvert (« /fr/finances/payer », « /payer ») — contexte de la question. */
    page: z
      .string()
      .max(200)
      .regex(/^\/[A-Za-z0-9\-_/]*(\?[A-Za-z0-9=&\-_]*)?$/, "chemin invalide")
      .optional(),
    langue: langueSchema.default("fr"),
  })
  .refine((b) => b.messages[b.messages.length - 1]?.role === "user", {
    message: "le dernier message doit venir de l'utilisateur",
    path: ["messages"],
  });

export type AssistantMessagesInput = z.infer<typeof assistantMessagesSchema>;

/** Sortie attendue du modèle (mode JSON) — revalidée, jamais crue sur parole. */
export const sortieModeleSchema = z.object({
  reponse: z.string().trim().min(1).max(4000),
  ecrans: z.array(z.string().max(64)).max(6).default([]),
});
