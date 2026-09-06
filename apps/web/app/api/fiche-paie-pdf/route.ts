/** Proxy du PDF de fiche de paie (M20) — GET /personnel/:id/fiches-paie/:fid/pdf?langue= avec la session des cookies (inline / ?download=1). */
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "../../../lib/session";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const personnel = sp.get("personnel");
  const fiche = sp.get("fiche");
  if (!personnel || !fiche || !/^[0-9a-f-]{36}$/i.test(personnel) || !/^[0-9a-f-]{36}$/i.test(fiche)) return NextResponse.json({ error: "ids requis" }, { status: 400 });
  const langue = sp.get("langue") === "ar" ? "ar" : "fr";
  const download = sp.get("download") === "1";
  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  const res = await fetch(`${API_BASE}/personnel/${personnel}/fiches-paie/${fiche}/pdf?langue=${langue}`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, ...(session.coproprieteId ? { "X-Copropriete-Id": session.coproprieteId } : {}) },
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: "pdf indisponible" }, { status: res.status });
  return new NextResponse(res.body, { headers: { "Content-Type": "application/pdf", "Content-Disposition": download ? (res.headers.get("Content-Disposition") ?? "attachment") : "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
