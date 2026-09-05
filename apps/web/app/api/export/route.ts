/**
 * Relais des exports csv / xlsx (M18) — l'API génère et JOURNALISE (export_log) dans le périmètre
 * RLS de l'appelant ; le navigateur ne parle jamais directement à l'API (jeton httpOnly).
 *   GET /api/export?ressource=lots|paiements|incidents|depenses|grand-livre|impayes|proprietaires&format=csv|xlsx&…filtres
 */
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "../../../lib/session";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";
const RESSOURCES: Record<string, { path: string; filtres: string[] }> = {
  lots: { path: "/lots", filtres: [] },
  paiements: { path: "/finances/paiements", filtres: ["exercice"] },
  incidents: { path: "/incidents", filtres: ["sejour_id"] },
  depenses: { path: "/depenses", filtres: ["exercice", "statut", "categorie", "source", "budget_poste_id", "prestataire_id", "date_from", "date_to", "q"] },
  "grand-livre": { path: "/rapports/grand-livre", filtres: ["exercice"] },
  impayes: { path: "/rapports/impayes", filtres: ["tranche", "lot_id"] },
  proprietaires: { path: "/rapports/proprietaires", filtres: [] },
};

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const ressource = RESSOURCES[sp.get("ressource") ?? ""];
  const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
  if (!ressource) return NextResponse.json({ error: "ressource inconnue" }, { status: 400 });
  const qs = new URLSearchParams({ format });
  for (const k of ressource.filtres) {
    const v = sp.get(k);
    if (v) qs.set(k, v);
  }
  const res = await fetch(`${API_BASE}${ressource.path}?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, ...(session.coproprieteId ? { "X-Copropriete-Id": session.coproprieteId } : {}) },
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: "export indisponible" }, { status: res.status });
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? `attachment; filename="export.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
