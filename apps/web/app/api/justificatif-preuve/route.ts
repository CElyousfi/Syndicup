/** Proxy de la preuve d'un justificatif — même origine, session par cookies, RLS de l'appelant. GET /api/justificatif-preuve?id=<justificatif>[&download=1] */
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "../../../lib/session";
const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const download = req.nextUrl.searchParams.get("download") === "1";
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "paramètres invalides" }, { status: 400 });
  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  const r = await fetch(`${API_BASE}/finances/justificatifs/${id}`, { headers: { Authorization: `Bearer ${session.accessToken}`, ...(session.coproprieteId ? { "X-Copropriete-Id": session.coproprieteId } : {}) }, cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: "justificatif indisponible" }, { status: r.status });
  const { data } = (await r.json()) as { data: { preuve: { url: string; nom: string } | null } };
  if (!data.preuve) return NextResponse.json({ error: "aucune preuve" }, { status: 404 });
  const f = await fetch(data.preuve.url, { cache: "no-store" });
  if (!f.ok) return NextResponse.json({ error: "stockage indisponible" }, { status: 502 });
  const pdf = data.preuve.nom.toLowerCase().endsWith(".pdf");
  return new NextResponse(f.body, { headers: { "Content-Type": f.headers.get("Content-Type") ?? (pdf ? "application/pdf" : "image/jpeg"), "Content-Disposition": download ? `attachment; filename="${data.preuve.nom.replace(/"/g, "")}"` : "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
