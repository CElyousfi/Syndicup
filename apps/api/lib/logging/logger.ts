/**
 * Logger JSON structuré — CLAUDE.md §5 : une ligne JSON par événement sur stdout, champs
 * obligatoires timestamp / request_id / copropriete_id / utilisateur_id / niveau.
 * Aucune PII en clair : toute clé ressemblant à un téléphone est masquée récursivement.
 * Volontairement sans dépendance (pas de pino/winston) — un collecteur type Axiom/Better Stack
 * ingère du JSON-per-line tel quel dès que M0 fournira le drain de logs.
 */
import { getRequestContext } from "../http/request-context-storage";

export type NiveauLog = "debug" | "info" | "warn" | "error";

/** Masque partiellement un numéro de téléphone : +212612345678 → +2126••••••78. */
export function maskTelephone(telephone: string): string {
  const visible = 5; // préfixe pays + 1er chiffre
  const suffixe = 2;
  if (telephone.length <= visible + suffixe) return "•".repeat(telephone.length);
  return (
    telephone.slice(0, visible) +
    "•".repeat(telephone.length - visible - suffixe) +
    telephone.slice(-suffixe)
  );
}

const CLE_TELEPHONE = /(telephone|phone)/i;
const CLES_INTERDITES = /(mot_de_passe|password|token|secret|authorization)/i;

function sanitize(value: unknown, cle?: string): unknown {
  if (typeof value === "string") {
    if (cle && CLES_INTERDITES.test(cle)) return "[MASQUÉ]";
    if (cle && CLE_TELEPHONE.test(cle)) return maskTelephone(value);
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => sanitize(v, cle));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitize(v, k);
    }
    return out;
  }
  return value;
}

function emit(niveau: NiveauLog, message: string, extra?: Record<string, unknown>): void {
  const ctx = getRequestContext();
  const ligne = {
    timestamp: new Date().toISOString(),
    niveau,
    message,
    request_id: ctx?.requestId ?? null,
    copropriete_id: ctx?.coproprieteId ?? null,
    utilisateur_id: ctx?.utilisateurId ?? null,
    ...(extra ? (sanitize(extra) as Record<string, unknown>) : {}),
  };
  process.stdout.write(`${JSON.stringify(ligne)}\n`);
}

export const logger = {
  debug: (message: string, extra?: Record<string, unknown>) => emit("debug", message, extra),
  info: (message: string, extra?: Record<string, unknown>) => emit("info", message, extra),
  warn: (message: string, extra?: Record<string, unknown>) => emit("warn", message, extra),
  error: (message: string, extra?: Record<string, unknown>) => emit("error", message, extra),
};
