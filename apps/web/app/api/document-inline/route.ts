/**
 * Proxy de lecture d'un document GED — permet l'APERÇU DANS L'APPLICATION (iframe même
 * origine) sans exposer l'URL signée du stockage. Le navigateur ne parle jamais
 * directement à l'API (jeton httpOnly) : ce handler demande l'URL signée (15 min) avec la
 * session des cookies, puis relaie le flux tel quel.
 *  - défaut : Content-Disposition inline (aperçu navigateur : PDF, images…)
 *  - ?download=1 : attachment (téléchargement)
 */
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "../../../lib/session";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const download = req.nextUrl.searchParams.get("download") === "1";
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id requis" }, { status: 400 });
  }

  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const signed = await fetch(`${API_BASE}/documents/${id}/download-url`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(session.coproprieteId ? { "X-Copropriete-Id": session.coproprieteId } : {}),
    },
    cache: "no-store",
  });
  if (!signed.ok) {
    return NextResponse.json({ error: "document indisponible" }, { status: signed.status });
  }
  const { data } = (await signed.json()) as { data: { url: string } };

  const fichier = await fetch(data.url, { cache: "no-store" });
  if (!fichier.ok) {
    return NextResponse.json({ error: "stockage indisponible" }, { status: 502 });
  }

  return new NextResponse(fichier.body, {
    headers: {
      "Content-Type": fichier.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": download ? "attachment" : "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
