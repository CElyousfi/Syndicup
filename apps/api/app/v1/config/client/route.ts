/**
 * GET /v1/config/client — drapeaux d'interface publics ({ flags: { alive_v1 } }).
 * Public (aucune donnée de copropriété, aucun secret), lecture seule, cache court (60 s) pour
 * qu'un basculement de ALIVE_V1 sur Render atteigne les clients en une minute au plus.
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { ok } from "../../../../lib/http/respond";
import { clientFlags } from "../../../../lib/config/client-flags";

export const dynamic = "force-dynamic";

async function handleGET() {
  const res = ok({ flags: clientFlags() });
  res.headers.set("Cache-Control", "public, max-age=60");
  return res;
}

export const GET = withApiHandler(handleGET);
