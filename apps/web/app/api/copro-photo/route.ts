/**
 * Proxy des photos personnalisées de la résidence (M20) — même principe que le logo : l'API
 * fournit des URLs signées (bucket privé), ce handler relaie le fichier depuis la même origine,
 * avec un cache court côté navigateur (`v` = chemin storage, invalide au changement).
 *   GET /api/copro-photo?id=<coproprieteId>&cle=<accueil|entree|cour|salle|piscine|espace:uuid>&v=<cache-buster>
 */
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "../../../lib/session";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";
const CLE = /^(accueil|entree|cour|salle|piscine|espace:[0-9a-f-]{36})$/i;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const cle = req.nextUrl.searchParams.get("cle");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !cle || !CLE.test(cle)) {
    return NextResponse.json({ error: "paramètres invalides" }, { status: 400 });
  }
  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const r = await fetch(`${API_BASE}/coproprietes/${id}/photos`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-Copropriete-Id": id },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: "photos indisponibles" }, { status: r.status });
  const { data } = (await r.json()) as { data: { photos: Record<string, string> } };
  const url = data.photos[cle];
  if (!url) return NextResponse.json({ error: "aucune photo" }, { status: 404 });

  const fichier = await fetch(url, { cache: "no-store" });
  if (!fichier.ok) return NextResponse.json({ error: "stockage indisponible" }, { status: 502 });
  return new NextResponse(fichier.body, {
    headers: {
      "Content-Type": fichier.headers.get("Content-Type") ?? "image/jpeg",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
