/**
 * Flux léger pour la coque : compteur de non-lues + 20 notifications les plus récentes (titre,
 * corps rendus dans la langue du destinataire, page cible). Session lue dans les cookies — le
 * navigateur n'appelle jamais l'API directement.
 *   GET /api/notifications-live?locale=fr
 */
import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api/client";
import { lienNotification } from "../../../lib/notifications-link";
import type { Notification } from "../../../lib/api/types";

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("locale") === "ar" ? "ar" : "fr";
  const res = await apiFetch<Notification[]>("/notifications");
  if (!res.ok) return NextResponse.json({ error: res.error.code }, { status: res.status ?? 500 });
  const items = res.data.slice(0, 20).map((n) => ({
    id: n.id,
    titre: n.rendu?.titre ?? n.templateCode,
    corps: n.rendu?.corps ?? "",
    lu: n.lu,
    href: lienNotification(n.templateCode, n.contenuJson, locale),
  }));
  return NextResponse.json(
    { unread: res.data.filter((n) => !n.lu).length, items },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
