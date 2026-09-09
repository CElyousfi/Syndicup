/**
 * Configuration d'environnement du web — validée une fois au démarrage (instrumentation.ts).
 * Le web ne parle qu'à l'API : API_BASE_URL est la seule variable structurante. Le repli
 * http://localhost:3001/v1 n'existe qu'en développement — en staging / production l'absence de
 * la variable fait échouer le démarrage (jamais un web de production qui parle à localhost).
 */
import { z } from "zod";

export const APP_ENVS = ["development", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

const vide = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const envWebSchema = z.object({
  NODE_ENV: z.preprocess(vide, z.enum(["development", "test", "production"]).optional()),
  APP_ENV: z.preprocess(vide, z.enum(APP_ENVS).optional()),
  PORT: z.preprocess(vide, z.coerce.number().int().positive().optional()),
  RENDER_GIT_COMMIT: z.preprocess(vide, z.string().max(64).optional()),
  /** Base de l'API, préfixe /v1 inclus (ex. https://api.syndicup.ma/v1). */
  API_BASE_URL: z.preprocess(vide, z.string().url("doit être une URL absolue, préfixe /v1 inclus").optional()),
  NEXT_PUBLIC_APP_URL: z.preprocess(vide, z.string().url().optional()),
});
export type EnvWeb = z.infer<typeof envWebSchema>;

export class EnvironnementInvalideError extends Error {
  constructor(public readonly problemes: string[]) {
    super(`Configuration d'environnement (web) invalide :\n  - ${problemes.join("\n  - ")}`);
  }
}

export function appEnvDe(env: Record<string, string | undefined> = process.env): AppEnv {
  const a = env.APP_ENV;
  if (a === "development" || a === "staging" || a === "production") return a;
  return env.NODE_ENV === "production" ? "production" : "development";
}

const REPLI_DEV = "http://localhost:3001/v1";

/**
 * Base de l'API : la variable, sinon le repli localhost. Ne lève jamais (évalué à l'import,
 * y compris pendant `next build`) : hors développement, c'est `parseEnvWeb` au démarrage du
 * serveur qui refuse l'absence de la variable — un web déployé ne parle jamais à localhost.
 */
export function apiBaseUrlDe(env: Record<string, string | undefined> = process.env): string {
  const v = vide(env.API_BASE_URL) as string | undefined;
  return v ? v.replace(/\/$/, "") : REPLI_DEV;
}

export function parseEnvWeb(env: Record<string, string | undefined> = process.env): EnvWeb {
  const parsed = envWebSchema.safeParse(env);
  const problemes: string[] = [];
  if (!parsed.success) for (const i of parsed.error.issues) problemes.push(`${i.path.join(".") || "?"} : ${i.message}`);
  if (appEnvDe(env) !== "development") {
    if (!vide(env.API_BASE_URL)) problemes.push("API_BASE_URL : obligatoire hors développement (aucun repli localhost)");
    if (!vide(env.APP_ENV)) problemes.push("APP_ENV : obligatoire (staging | production)");
  }
  if (problemes.length > 0) throw new EnvironnementInvalideError(problemes);
  return parsed.success ? parsed.data : ({} as EnvWeb);
}

let memo: EnvWeb | null = null;
export function validerEnvironnementWeb(): EnvWeb {
  if (memo) return memo;
  memo = parseEnvWeb(process.env);
  return memo;
}

/** Base de l'API utilisée par tous les proxys / clients serveur du web. */
export const API_BASE_URL: string = apiBaseUrlDe();
