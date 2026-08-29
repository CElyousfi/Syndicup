/**
 * Flux temps réel des notifications (Server-Sent Events) — relais de `GET /v1/notifications/stream`
 * avec la session des cookies : le navigateur ouvre UNE connexion et reçoit chaque nouvelle
 * notification à l'instant où elle est créée (toast + cloche + re-synchronisation de la page).
 *   GET /api/notifications-stream
 */
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "../../../lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const amont = await fetch(`${API_BASE}/notifications/stream`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "text/event-stream",
      ...(session.coproprieteId ? { "X-Copropriete-Id": session.coproprieteId } : {}),
    },
    signal: req.signal,
    cache: "no-store",
  });
  if (!amont.ok || !amont.body) {
    return NextResponse.json({ error: "flux indisponible" }, { status: amont.status || 502 });
  }
  return new NextResponse(amont.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
