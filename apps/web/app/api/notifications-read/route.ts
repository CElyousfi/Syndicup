/**
 * Marquage « lu » d'une notification — appelé en arrière-plan par le client (optimiste :
 * l'interface a déjà basculé). Relais de PATCH /notifications/:id/read avec la session.
 *   POST /api/notifications-read  { id }
 */
import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api/client";
import type { Notification } from "../../../lib/api/types";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const res = await apiFetch<Notification>(`/notifications/${body.id}/read`, { method: "PATCH" });
  if (!res.ok) return NextResponse.json({ error: res.error.code }, { status: res.status });
  return NextResponse.json({ ok: true, lu: res.data.lu });
}
