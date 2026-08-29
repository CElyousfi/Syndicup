/**
 * Proxy du logo de la copropriété — même principe que les photos d'incident : l'API fournit
 * une URL signée (bucket privé), ce handler relaie le fichier depuis la même origine, avec un
 * cache court côté navigateur (le logo change rarement ; `v` invalide au changement).
 *   GET /api/copro-logo?id=<coproprieteId>&v=<cache-buster>
 */
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "../../../lib/session";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "paramètres invalides" }, { status: 400 });
  }
  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const r = await fetch(`${API_BASE}/coproprietes/${id}/logo`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, "X-Copropriete-Id": id },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: "logo indisponible" }, { status: r.status });
  const { data } = (await r.json()) as { data: { url: string | null } };
  if (!data.url) return NextResponse.json({ error: "aucun logo" }, { status: 404 });

  const fichier = await fetch(data.url, { cache: "no-store" });
  if (!fichier.ok) return NextResponse.json({ error: "stockage indisponible" }, { status: 502 });
  return new NextResponse(fichier.body, {
    headers: {
      "Content-Type": fichier.headers.get("Content-Type") ?? "image/png",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
