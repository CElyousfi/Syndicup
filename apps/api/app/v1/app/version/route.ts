/**
 * GET /v1/app/version?plateforme=android&version=1.2.0 — porte de mise à jour mobile.
 * Public, sans authentification : l'app l'appelle au lancement avant toute session.
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { verdict, type Plateforme } from "../../../../lib/app-version";
import { ok, fail } from "../../../../lib/http/respond";

async function handleGET(req: Request) {
  const url = new URL(req.url);
  const plateforme = url.searchParams.get("plateforme");
  if (plateforme !== "android" && plateforme !== "ios") {
    return fail("VALIDATION_ERROR", "plateforme attendue : android | ios.");
  }
  const version = url.searchParams.get("version");
  const res = ok(verdict(plateforme as Plateforme, version));
  // 5 min de cache public : l'app interroge à chaque lancement, l'edge absorbe le volume.
  res.headers.set("Cache-Control", "public, max-age=300");
  return res;
}

export const GET = withApiHandler(handleGET);
