/**
 * GET /v1/notifications/stream — Server-Sent Events : l'appelant reçoit chaque nouvelle
 * notification à l'instant (≤ 2 s) sans rafraîchir. Événements :
 *   - `etat`         { unread, connus[] }  à l'ouverture
 *   - `notification` { id, titre, corps, lu, unread }
 *   - `ping`         toutes les 20 s (garde la connexion vivante derrière les proxys)
 * Lecture courte sous RLS à chaque tick ; la connexion se ferme quand le client part.
 */
import {
  etatNotifications,
  nouvellesNotificationsDepuis,
  PermissionRefuseeError,
} from "../../../../lib/notifications/notifications";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { fail } from "../../../../lib/http/respond";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TICK_MS = 2000;
const PING_MS = 20_000;
const MAX_DUREE_MS = 55 * 60 * 1000; // le client se reconnecte (EventSource) — jamais de connexion éternelle

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await tenantFromRequest(req);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    throw e;
  }

  let etat;
  try {
    etat = await etatNotifications(ctx);
  } catch (e) {
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }

  const encoder = new TextEncoder();
  let depuis = new Date();
  const debut = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const envoyer = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      envoyer("etat", etat);

      let enCours = false;
      const tick = async () => {
        if (enCours) return;
        enCours = true;
        try {
          const { rows, unread } = await nouvellesNotificationsDepuis(ctx, depuis);
          for (const n of rows) {
            envoyer("notification", {
              id: n.id,
              titre: n.titre,
              corps: n.corps,
              lu: n.lu,
              unread,
              templateCode: n.templateCode,
              contenuJson: n.contenuJson,
            });
            if (n.horodatageEnvoi > depuis) depuis = n.horodatageEnvoi;
          }
        } catch {
          // Base momentanément indisponible : le prochain tick réessaie ; jamais de crash du flux.
        } finally {
          enCours = false;
        }
        if (Date.now() - debut > MAX_DUREE_MS) fermer();
      };
      const timer = setInterval(tick, TICK_MS);
      const ping = setInterval(() => controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`)), PING_MS);
      const fermer = () => {
        clearInterval(timer);
        clearInterval(ping);
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
      };
      req.signal.addEventListener("abort", fermer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
