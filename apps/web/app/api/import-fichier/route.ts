/**
 * Relais des fichiers d'import (M24) — session par cookies, périmètre RLS de l'appelant :
 *   GET /api/import-fichier?kind=modele&type=LOTS_PROPRIETAIRES&langue=fr   → modèle xlsx
 *   GET /api/import-fichier?kind=rapport&id=<import_job_id>                 → rapport csv
 *   GET /api/import-fichier?kind=invitations&canal=CSV|WHATSAPP[&import_job_id=] → csv des liens (POST côté API, audité)
 */
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "../../../lib/session";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  const headers = { Authorization: `Bearer ${session.accessToken}`, ...(session.coproprieteId ? { "X-Copropriete-Id": session.coproprieteId } : {}) };
  const kind = req.nextUrl.searchParams.get("kind");
  let res: Response;
  let nom = "fichier";
  if (kind === "modele") {
    const type = (req.nextUrl.searchParams.get("type") ?? "").replace(/[^A-Z_]/g, "");
    const langue = req.nextUrl.searchParams.get("langue") === "ar" ? "ar" : "fr";
    res = await fetch(`${API_BASE}/import/modeles/${type}?langue=${langue}`, { headers, cache: "no-store" });
    nom = `modele-${type.toLowerCase()}-${langue}.xlsx`;
  } else if (kind === "rapport") {
    const id = (req.nextUrl.searchParams.get("id") ?? "").replace(/[^0-9a-f-]/gi, "");
    res = await fetch(`${API_BASE}/import/${id}/rapport.csv`, { headers, cache: "no-store" });
    nom = `import-${id.slice(0, 8)}-rapport.csv`;
  } else if (kind === "invitations") {
    const canal = req.nextUrl.searchParams.get("canal") === "WHATSAPP" ? "WHATSAPP" : "CSV";
    const importJobId = req.nextUrl.searchParams.get("import_job_id");
    res = await fetch(`${API_BASE}/invitations/envoyer-en-masse`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ canal, ...(importJobId ? { import_job_id: importJobId } : {}) }), cache: "no-store" });
    nom = "invitations.csv";
  } else {
    return NextResponse.json({ error: "kind inconnu" }, { status: 400 });
  }
  if (!res.ok) return NextResponse.json({ error: "fichier indisponible" }, { status: res.status });
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? `attachment; filename="${nom}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
