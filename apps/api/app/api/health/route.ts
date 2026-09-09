/** GET /api/health — sonde Render (200 ok / 503 base injoignable). Sans auth, sans rate limiting, hors contrat OpenAPI. */
import { etatSante } from "../../../lib/health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const { corps, statut } = await etatSante();
  return Response.json(corps, { status: statut, headers: { "Cache-Control": "no-store" } });
}
