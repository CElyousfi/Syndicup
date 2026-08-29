/**
 * Proxy d'une photo de signalement — le navigateur ne touche jamais l'hôte du stockage
 * (URL signée locale 127.0.0.1 en dev, bucket privé en prod) : ce handler demande les URLs
 * signées à l'API avec la session des cookies, puis relaie le flux de la photo demandée.
 * Même origine → visible sur tout appareil (téléphone, tunnel, desktop), jamais mis en cache.
 *   GET /api/incident-photo?id=<incidentId>&n=<index>
 */
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "../../../lib/session";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const n = Number(req.nextUrl.searchParams.get("n") ?? "0");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(n) || n < 0 || n > 4) {
    return NextResponse.json({ error: "paramètres invalides" }, { status: 400 });
  }

  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const photos = await fetch(`${API_BASE}/incidents/${id}/photos`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(session.coproprieteId ? { "X-Copropriete-Id": session.coproprieteId } : {}),
    },
    cache: "no-store",
  });
  if (!photos.ok) return NextResponse.json({ error: "photos indisponibles" }, { status: photos.status });
  const { data } = (await photos.json()) as { data: Array<{ url: string }> };
  const cible = data[n];
  if (!cible) return NextResponse.json({ error: "photo introuvable" }, { status: 404 });

  const fichier = await fetch(cible.url, { cache: "no-store" });
  if (!fichier.ok) return NextResponse.json({ error: "stockage indisponible" }, { status: 502 });

  return new NextResponse(fichier.body, {
    headers: {
      "Content-Type": fichier.headers.get("Content-Type") ?? "image/jpeg",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
