/**
 * J2 — export des données personnelles (droit d'accès CNDP, Loi 09-08) : relaie
 * GET /users/me/export et sert le JSON en téléchargement.
 */
import { apiFetch } from "../../../lib/api/client";
import type { ExportCndp } from "../../../lib/api/types";

export async function GET() {
  const res = await apiFetch<ExportCndp>("/users/me/export");
  if (!res.ok) {
    return Response.json({ error: res.error }, { status: res.status });
  }
  return new Response(JSON.stringify(res.data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="syndicup-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
