/**
 * Proxy des fichiers d'une dépense (factures, preuve de paiement) — le navigateur ne touche jamais
 * l'hôte du stockage : ce handler demande les URLs signées à l'API avec la session des cookies,
 * puis relaie le flux (inline pour la visionneuse intégrée, ?download=1 pour télécharger).
 *   GET /api/depense-document?id=<depense>&type=facture&n=<index>[&download=1]
 *   GET /api/depense-document?id=<depense>&type=justificatif[&download=1]
 */
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "../../../lib/session";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const type = req.nextUrl.searchParams.get("type") ?? "facture";
  const n = Number(req.nextUrl.searchParams.get("n") ?? "0");
  const download = req.nextUrl.searchParams.get("download") === "1";
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !["facture", "justificatif"].includes(type) || !Number.isInteger(n) || n < 0 || n > 50) {
    return NextResponse.json({ error: "paramètres invalides" }, { status: 400 });
  }
  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const docs = await fetch(`${API_BASE}/depenses/${id}/documents`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, ...(session.coproprieteId ? { "X-Copropriete-Id": session.coproprieteId } : {}) },
    cache: "no-store",
  });
  if (!docs.ok) return NextResponse.json({ error: "documents indisponibles" }, { status: docs.status });
  const { data } = (await docs.json()) as {
    data: { factures: Array<{ url: string; nom: string }>; justificatif_paiement: { url: string; nom: string } | null };
  };
  const cible = type === "facture" ? data.factures[n] : data.justificatif_paiement;
  if (!cible) return NextResponse.json({ error: "fichier introuvable" }, { status: 404 });

  const fichier = await fetch(cible.url, { cache: "no-store" });
  if (!fichier.ok) return NextResponse.json({ error: "stockage indisponible" }, { status: 502 });
  const pdf = cible.nom.toLowerCase().endsWith(".pdf");
  return new NextResponse(fichier.body, {
    headers: {
      "Content-Type": fichier.headers.get("Content-Type") ?? (pdf ? "application/pdf" : "image/jpeg"),
      "Content-Disposition": download ? `attachment; filename="${cible.nom.replace(/"/g, "")}"` : "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
