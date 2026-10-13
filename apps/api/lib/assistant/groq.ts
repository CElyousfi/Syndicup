/**
 * Client Groq (API compatible OpenAI) pour Dari — côté serveur uniquement : la clé
 * GROQ_API_KEY ne quitte jamais l'API (ni le web, ni le mobile ne la voient).
 *
 * Chaîne de modèles : si un modèle est saturé (429), indisponible (5xx/404) ou trop lent, on
 * passe au suivant. Si tous échouent → AssistantIndisponibleError (503 côté route).
 */
import { logger } from "../logging/logger";

export const MODELES = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"] as const;
const URL_GROQ = "https://api.groq.com/openai/v1/chat/completions";
const DELAI_MS = 20_000;

export class AssistantNonConfigureError extends Error {}
export class AssistantIndisponibleError extends Error {}

export interface MessageLlm {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ReponseLlm {
  contenu: string;
  modele: string;
}

type Fetch = typeof fetch;

export async function completerChat(
  messages: MessageLlm[],
  opts: { cle?: string; fetchImpl?: Fetch; modeles?: readonly string[] } = {}
): Promise<ReponseLlm> {
  const cle = opts.cle ?? process.env.GROQ_API_KEY;
  if (!cle) throw new AssistantNonConfigureError("GROQ_API_KEY absente : l'assistant n'est pas configuré sur ce déploiement.");
  const f = opts.fetchImpl ?? fetch;

  for (const modele of opts.modeles ?? MODELES) {
    const raisonnement = modele.startsWith("openai/gpt-oss");
    let res: Response;
    try {
      res = await f(URL_GROQ, {
        method: "POST",
        headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modele,
          messages,
          temperature: 0.3,
          max_completion_tokens: raisonnement ? 1400 : 700,
          response_format: { type: "json_object" },
          ...(raisonnement ? { reasoning_effort: "low" } : {}),
        }),
        signal: AbortSignal.timeout(DELAI_MS),
      });
    } catch (e) {
      logger.warn("assistant.modele_injoignable", { modele, erreur: e instanceof Error ? e.name : "inconnue" });
      continue;
    }
    if (!res.ok) {
      // 429 (quota), 5xx, 404 (modèle retiré), 400 (JSON invalide généré) : modèle suivant.
      logger.warn("assistant.modele_refus", { modele, statut: res.status });
      await res.body?.cancel().catch(() => undefined);
      continue;
    }
    const json = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string | null } }> } | null;
    const contenu = json?.choices?.[0]?.message?.content?.trim();
    if (!contenu) {
      logger.warn("assistant.reponse_vide", { modele });
      continue;
    }
    return { contenu, modele };
  }
  throw new AssistantIndisponibleError("Tous les modèles de l'assistant sont indisponibles.");
}
