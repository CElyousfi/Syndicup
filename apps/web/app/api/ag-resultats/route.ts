/**
 * Proxy de lecture pour la séance live (E5) : le navigateur ne parle jamais directement à
 * l'API (jeton httpOnly) — ce handler relaie GET resultats avec la session des cookies.
 * Réponse : { resolution, resultats } pour rafraîchir l'écran de séance sans rechargement.
 */
import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api/client";
import type { AgResolution, AgResultatLigne, AssembleeGenerale } from "../../../lib/api/types";

export async function GET(req: NextRequest) {
  const agId = req.nextUrl.searchParams.get("ag");
  const resolutionId = req.nextUrl.searchParams.get("resolution");
  if (!agId) return NextResponse.json({ error: "ag requis" }, { status: 400 });

  const agRes = await apiFetch<AssembleeGenerale & { resolutions: AgResolution[] }>(
    `/ag/${agId}`
  );
  if (!agRes.ok) {
    return NextResponse.json({ error: agRes.error.code }, { status: agRes.status });
  }

  let resultats: AgResultatLigne[] | null = null;
  if (resolutionId) {
    const r = await apiFetch<AgResultatLigne[]>(
      `/ag/${agId}/resolutions/${resolutionId}/resultats`
    );
    resultats = r.ok ? r.data : null;
  }

  return NextResponse.json({
    statut: agRes.data.statut,
    resolutions: agRes.data.resolutions ?? [],
    resultats,
  });
}
