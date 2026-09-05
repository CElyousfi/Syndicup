/**
 * Proxy du PDF du rapport de gestion (M18) — GET /rapports/gestion/:id/pdf?langue=&variante=
 * relayé avec la session des cookies (inline pour la visionneuse intégrée, ?download=1 sinon).
 */
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "../../../lib/session";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = sp.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const langue = sp.get("langue") === "ar" ? "ar" : "fr";
  const variante = sp.get("variante") === "complete" ? "complete" : "publique";
  const download = sp.get("download") === "1";
  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  const res = await fetch(`${API_BASE}/rapports/gestion/${id}/pdf?langue=${langue}&variante=${variante}`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, ...(session.coproprieteId ? { "X-Copropriete-Id": session.coproprieteId } : {}) },
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: "pdf indisponible" }, { status: res.status });
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": download ? (res.headers.get("Content-Disposition") ?? "attachment") : "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
