/**
 * GET /health — sonde Render du web : version, commit et joignabilité de l'API
 * (GET <api-origin>/api/health). 503 si l'API ne répond pas « ok ». Sans auth, hors locale
 * (exclu du middleware), jamais mis en cache.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { API_BASE_URL } from "../../lib/config/env";

export const dynamic = "force-dynamic";

let versionMemo: string | null = null;
function version(): string {
  if (versionMemo) return versionMemo;
  try {
    versionMemo = (JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { version?: string }).version ?? "0.0.0";
  } catch {
    versionMemo = "0.0.0";
  }
  return versionMemo;
}

export async function GET(): Promise<Response> {
  let api: "ok" | "error" = "ok";
  try {
    const origine = new URL(API_BASE_URL).origin;
    const res = await fetch(`${origine}/api/health`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!res.ok) api = "error";
  } catch {
    api = "error";
  }
  return Response.json(
    { status: api === "ok" ? "ok" : "degraded", version: version(), commit: process.env.RENDER_GIT_COMMIT?.trim() || null, api },
    { status: api === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
