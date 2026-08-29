/**
 * Proxy du PDF de procès-verbal — récupère l'URL signée 15 min auprès de l'API puis redirige
 * le navigateur dessus (le PDF est servi directement par Supabase Storage).
 */
import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api/client";

export async function GET(req: NextRequest) {
  const agId = req.nextUrl.searchParams.get("ag");
  if (!agId) return NextResponse.json({ error: "ag requis" }, { status: 400 });

  const res = await apiFetch<{ url: string }>(`/ag/${agId}/pv/pdf`);
  if (!res.ok) {
    return NextResponse.json({ error: res.error.message }, { status: res.status });
  }
  return NextResponse.redirect(res.data.url);
}
