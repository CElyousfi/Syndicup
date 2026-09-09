/**
 * Health check (Render `healthCheckPath`) : version (package.json), commit (RENDER_GIT_COMMIT)
 * et ping base (`SELECT 1` via Prisma). 503 si la base ne répond pas. Sans auth, hors rate
 * limiting (Render l'appelle toutes les quelques secondes), hors contrat OpenAPI (infrastructure,
 * comme /api/inngest — le script de conformité ne scanne que app/v1).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { pingDatabase } from "./tenant/db";

let versionMemo: string | null = null;
export function versionApplication(): string {
  if (versionMemo) return versionMemo;
  try {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { version?: string };
    versionMemo = pkg.version ?? "0.0.0";
  } catch {
    versionMemo = "0.0.0";
  }
  return versionMemo;
}

export interface EtatSante {
  status: "ok" | "degraded";
  version: string;
  commit: string | null;
  db: "ok" | "error";
}

export async function etatSante(ping: () => Promise<void> = pingDatabase): Promise<{ corps: EtatSante; statut: 200 | 503 }> {
  let db: EtatSante["db"] = "ok";
  try {
    await ping();
  } catch {
    db = "error";
  }
  const corps: EtatSante = {
    status: db === "ok" ? "ok" : "degraded",
    version: versionApplication(),
    commit: process.env.RENDER_GIT_COMMIT?.trim() || null,
    db,
  };
  return { corps, statut: db === "ok" ? 200 : 503 };
}
