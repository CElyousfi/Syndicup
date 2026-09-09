/**
 * Configuration d'environnement de l'API — UNE seule lecture validée (Zod) au démarrage
 * (instrumentation.ts), messages d'erreur par variable. Chaque variable lue par `lib/` est
 * déclarée ici ; en production les variables listées dans REQUIS_EN_PRODUCTION sont
 * obligatoires, ailleurs elles sont optionnelles (Supabase local, transports noop…).
 *
 * Les modules continuent de lire `process.env` là où c'est déjà le cas ; ce fichier garantit
 * qu'un déploiement mal configuré ÉCHOUE AU DÉMARRAGE (Render : le health check reste rouge,
 * l'ancienne version reste en ligne) plutôt qu'à la première requête.
 */
import { z } from "zod";
import { logger } from "../logging/logger";

export const APP_ENVS = ["development", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

const vide = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optStr = (max = 4000) => z.preprocess(vide, z.string().max(max).optional());
const optUrl = () => z.preprocess(vide, z.string().url("doit être une URL absolue (https://…)").optional());
const optEntier = () => z.preprocess(vide, z.coerce.number().int().positive().optional());
const postgresUrl = () =>
  z.preprocess(vide, z.string().regex(/^postgres(ql)?:\/\//, "doit commencer par postgresql://").optional());

/** Toutes les variables lues par apps/api (grep `process.env` dans lib/, app/, inngest/). */
export const envSchema = z.object({
  NODE_ENV: z.preprocess(vide, z.enum(["development", "test", "production"]).optional()),
  /** Environnement applicatif (Sentry, garde-fous) — remplace VERCEL_ENV. Repli : NODE_ENV. */
  APP_ENV: z.preprocess(vide, z.enum(APP_ENVS).optional()),
  PORT: optEntier(),
  /** Posé par Render à chaque déploiement (exposé par GET /api/health). */
  RENDER_GIT_COMMIT: optStr(64),

  // ── Base de données (Prisma) ──
  DATABASE_URL: postgresUrl(),
  DIRECT_URL: postgresUrl(),

  // ── Supabase (Auth + Storage) ──
  NEXT_PUBLIC_SUPABASE_URL: optUrl(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optStr(),
  SUPABASE_SERVICE_ROLE_KEY: optStr(),
  JWT_SECRET: z.preprocess(vide, z.string().min(32, "au moins 32 caractères").optional()),

  // ── Inngest (jobs) ──
  INNGEST_EVENT_KEY: optStr(),
  INNGEST_SIGNING_KEY: optStr(),
  INNGEST_DEV: optStr(8),

  // ── Application ──
  NEXT_PUBLIC_APP_URL: optUrl(),

  // ── Rate limiting global (Upstash Redis REST) ──
  UPSTASH_REDIS_REST_URL: optUrl(),
  UPSTASH_REDIS_REST_TOKEN: optStr(),
  RATE_LIMIT_OTP_REQUEST_MAX: optEntier(),
  RATE_LIMIT_AUTH_MAX: optEntier(),
  RATE_LIMIT_FINANCE_MAX: optEntier(),
  RATE_LIMIT_COMMENTAIRE_MAX: optEntier(),
  RATE_LIMIT_CMI_WEBHOOK_MAX: optEntier(),

  // ── Transports de notification (optionnels : noop honnête sinon) ──
  RESEND_API_KEY: optStr(),
  RESEND_FROM: optStr(320),
  /** @deprecated remplacé par RESEND_FROM — encore lu une version, avec avertissement. */
  RESEND_FROM_EMAIL: optStr(320),
  SMTP_URL: z.preprocess(vide, z.string().regex(/^smtps?:\/\//, "doit commencer par smtp:// ou smtps://").optional()),
  EMAIL_FROM: optStr(320),
  SMS_PROVIDER: z.preprocess(vide, z.enum(["twilio", "generic", "dev"]).optional()),
  SMS_API_URL: optUrl(),
  SMS_API_KEY: optStr(),
  SMS_API_SECRET: optStr(),
  SMS_SENDER_ID: optStr(64),
  FCM_SERVICE_ACCOUNT_JSON: z.preprocess(
    vide,
    z
      .string()
      .refine((s) => {
        try {
          const j = JSON.parse(s) as Record<string, unknown>;
          return Boolean(j.project_id && j.client_email && j.private_key);
        } catch {
          return false;
        }
      }, "doit être le JSON complet du service account (project_id, client_email, private_key)")
      .optional()
  ),

  // ── Observabilité ──
  SENTRY_DSN: optUrl(),

  // ── CMI (paiement en ligne) — non utilisé au lancement : routes en 501 tant qu'absent ──
  CMI_MERCHANT_ID: optStr(),
  CMI_STORE_KEY: optStr(),
  CMI_API_URL: optUrl(),
  CMI_WEBHOOK_HMAC_SECRET: optStr(),

  // ── Paramètres techniques ──
  AG_RAPPEL_JOURS_AVANT: optEntier(),
});

export type Env = z.infer<typeof envSchema>;

/** Obligatoires quand APP_ENV = production (ou NODE_ENV = production sans APP_ENV). */
export const REQUIS_EN_PRODUCTION = [
  "DATABASE_URL",
  "DIRECT_URL",
  "JWT_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
  "NEXT_PUBLIC_APP_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "APP_ENV",
] as const satisfies ReadonlyArray<keyof Env>;

export class EnvironnementInvalideError extends Error {
  constructor(public readonly problemes: string[]) {
    super(`Configuration d'environnement invalide :\n  - ${problemes.join("\n  - ")}`);
  }
}

/** APP_ENV effectif : la variable, sinon dérivé de NODE_ENV (production → production, sinon development). */
export function appEnvDe(env: Record<string, string | undefined> = process.env): AppEnv {
  const a = env.APP_ENV;
  if (a === "development" || a === "staging" || a === "production") return a;
  return env.NODE_ENV === "production" ? "production" : "development";
}

/** Vrai en production (garde-fous : Upstash obligatoire, pas de repli localhost, etc.). */
export function estProduction(env: Record<string, string | undefined> = process.env): boolean {
  return appEnvDe(env) === "production";
}

/**
 * Parse + règles inter-variables. Lève EnvironnementInvalideError avec UN message par variable.
 * Pur (injectable) pour les tests ; `validerEnvironnement()` mémoïse sur process.env.
 */
export function parseEnv(env: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(env);
  const problemes: string[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      problemes.push(`${issue.path.join(".") || "?"} : ${issue.message}`);
    }
  }
  const valeurs = parsed.success ? parsed.data : ({} as Env);
  const production = estProduction(env);
  if (production) {
    for (const nom of REQUIS_EN_PRODUCTION) {
      if (vide(env[nom]) === undefined) problemes.push(`${nom} : obligatoire en production (voir docs/DEPLOYMENT.md)`);
    }
    if (env.INNGEST_DEV) problemes.push("INNGEST_DEV : interdit en production (le serveur de dev Inngest ne doit pas être ciblé)");
  }
  // Paires cohérentes.
  if ((env.UPSTASH_REDIS_REST_URL && !env.UPSTASH_REDIS_REST_TOKEN) || (!env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)) {
    problemes.push("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN : les deux sont requis ensemble");
  }
  if (env.RESEND_API_KEY && !resendFromDe(env)) problemes.push("RESEND_FROM : requis avec RESEND_API_KEY (adresse d'expédition)");
  if (env.SMTP_URL && !env.EMAIL_FROM) problemes.push("EMAIL_FROM : requis avec SMTP_URL");
  if (env.SMS_PROVIDER === "twilio" && !(env.SMS_API_KEY && env.SMS_API_SECRET && env.SMS_SENDER_ID)) {
    problemes.push("SMS_API_KEY / SMS_API_SECRET / SMS_SENDER_ID : requis avec SMS_PROVIDER=twilio");
  }
  if (env.SMS_PROVIDER === "generic" && !(env.SMS_API_URL && env.SMS_API_KEY)) {
    problemes.push("SMS_API_URL / SMS_API_KEY : requis avec SMS_PROVIDER=generic");
  }
  if (problemes.length > 0) throw new EnvironnementInvalideError(problemes);
  return valeurs;
}

let deprecationSignalee = false;
/** Adresse d'expédition Resend : RESEND_FROM, avec repli déprécié sur RESEND_FROM_EMAIL (une version). */
export function resendFromDe(env: Record<string, string | undefined> = process.env): string | undefined {
  const from = vide(env.RESEND_FROM) as string | undefined;
  if (from) return from;
  const ancien = vide(env.RESEND_FROM_EMAIL) as string | undefined;
  if (ancien && !deprecationSignalee) {
    deprecationSignalee = true;
    logger.warn("RESEND_FROM_EMAIL est déprécié : renommez la variable en RESEND_FROM (repli retiré à la prochaine version).");
  }
  return ancien;
}

/** Réservé aux tests. */
export function _resetDeprecationResend(): void {
  deprecationSignalee = false;
}

/** Paiement CMI configuré ? (non utilisé au lancement — les routes répondent 501 sinon.) */
export function cmiEstConfigure(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(vide(env.CMI_WEBHOOK_HMAC_SECRET));
}

let memo: Env | null = null;
/** Validation unique au démarrage (instrumentation.ts) — relance la même erreur à chaque appel si invalide. */
export function validerEnvironnement(): Env {
  if (memo) return memo;
  memo = parseEnv(process.env);
  logger.info("Environnement validé", { app_env: appEnvDe(), upstash: Boolean(memo.UPSTASH_REDIS_REST_URL), sentry: Boolean(memo.SENTRY_DSN) });
  return memo;
}
