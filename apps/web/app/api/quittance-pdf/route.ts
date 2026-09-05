/**
 * Proxy du PDF de quittance — le navigateur ne parle jamais directement à l'API (jeton
 * httpOnly) : ce handler relaie GET /finances/quittances/:id/pdf avec la session des cookies
 * et transmet le flux PDF tel quel (inline pour la visionneuse intégrée, ?download=1 sinon).
 */
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "../../../lib/session";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const download = req.nextUrl.searchParams.get("download") === "1";
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const res = await fetch(`${API_BASE}/finances/quittances/${id}/pdf`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(session.coproprieteId ? { "X-Copropriete-Id": session.coproprieteId } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: "pdf indisponible" }, { status: res.status });
  }
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "application/pdf",
      // Visionneuse dans l'application par défaut ; ?download=1 = téléchargement.
      "Content-Disposition": download ? (res.headers.get("Content-Disposition") ?? "attachment") : "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
