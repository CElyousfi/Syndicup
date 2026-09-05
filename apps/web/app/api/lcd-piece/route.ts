/**
 * Proxy d'une pièce jointe de séjour LCD — le navigateur ne touche jamais l'hôte du stockage :
 * ce handler demande les URLs signées à l'API avec la session des cookies, puis relaie le flux
 * (inline pour la visionneuse intégrée, ?download=1 pour télécharger).
 *   GET /api/lcd-piece?sejour=<id>&n=<index>[&download=1]
 */
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "../../../lib/session";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("sejour");
  const n = Number(req.nextUrl.searchParams.get("n") ?? "0");
  const download = req.nextUrl.searchParams.get("download") === "1";
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(n) || n < 0 || n > 9) {
    return NextResponse.json({ error: "paramètres invalides" }, { status: 400 });
  }
  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const pieces = await fetch(`${API_BASE}/lcd/sejours/${id}/pieces-jointes`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, ...(session.coproprieteId ? { "X-Copropriete-Id": session.coproprieteId } : {}) },
    cache: "no-store",
  });
  if (!pieces.ok) return NextResponse.json({ error: "pièces indisponibles" }, { status: pieces.status });
  const { data } = (await pieces.json()) as { data: Array<{ url: string; nom: string; type: string }> };
  const cible = data[n];
  if (!cible) return NextResponse.json({ error: "pièce introuvable" }, { status: 404 });

  const fichier = await fetch(cible.url, { cache: "no-store" });
  if (!fichier.ok) return NextResponse.json({ error: "stockage indisponible" }, { status: 502 });
  return new NextResponse(fichier.body, {
    headers: {
      "Content-Type": fichier.headers.get("Content-Type") ?? (cible.type === "PDF" ? "application/pdf" : "image/jpeg"),
      "Content-Disposition": download ? `attachment; filename="${cible.nom.replace(/"/g, "")}"` : "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
