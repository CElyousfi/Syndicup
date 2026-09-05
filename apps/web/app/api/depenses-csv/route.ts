/**
 * Export CSV des dépenses — relais de `GET /depenses?format=csv` (généré et journalisé côté API,
 * périmètre RLS de l'appelant). Session par cookies, mêmes filtres que la liste.
 *   GET /api/depenses-csv?exercice=YYYY&statut=…&categorie=…
 */
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "../../../lib/session";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";
const FILTRES = ["exercice", "statut", "categorie", "source", "budget_poste_id", "prestataire_id", "date_from", "date_to", "q"];

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  const qs = new URLSearchParams({ format: "csv" });
  for (const k of FILTRES) {
    const v = req.nextUrl.searchParams.get(k);
    if (v) qs.set(k, v);
  }
  const res = await fetch(`${API_BASE}/depenses?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, ...(session.coproprieteId ? { "X-Copropriete-Id": session.coproprieteId } : {}) },
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: "export indisponible" }, { status: res.status });
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? 'attachment; filename="depenses.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
