/**
 * Proxy du PDF de procès-verbal — récupère l'URL signée 15 min auprès de l'API puis relaie le
 * flux depuis la même origine : le PDF s'ouvre DANS l'application (visionneuse), jamais dans
 * un onglet vers le stockage. `?download=1` force le téléchargement.
 */
import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api/client";

export async function GET(req: NextRequest) {
  const agId = req.nextUrl.searchParams.get("ag");
  const download = req.nextUrl.searchParams.get("download") === "1";
  if (!agId || !/^[0-9a-f-]{36}$/i.test(agId)) return NextResponse.json({ error: "ag requis" }, { status: 400 });

  const res = await apiFetch<{ url: string }>(`/ag/${agId}/pv/pdf`);
  if (!res.ok) {
    return NextResponse.json({ error: res.error.message }, { status: res.status });
  }
  const fichier = await fetch(res.data.url, { cache: "no-store" });
  if (!fichier.ok) return NextResponse.json({ error: "stockage indisponible" }, { status: 502 });
  return new NextResponse(fichier.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": download ? `attachment; filename="pv-${agId}.pdf"` : "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
