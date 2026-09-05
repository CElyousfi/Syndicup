/** GET /v1/rapports/grand-livre?exercice=&format=csv|xlsx — journal chronologique (syndic / conseil). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { formatDemande, reponseExport } from "../../../../lib/http/export";
import { obtenirGrandLivre, exporterGrandLivre } from "../../../../lib/rapports/grand-livre";
import { exerciceQuerySchema } from "../../../../lib/rapports/schemas";
import { mapErreurRapports } from "../../../../lib/rapports/http";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const parsed = exerciceQuerySchema.safeParse({ exercice: url.searchParams.get("exercice") ?? undefined });
    if (!parsed.success) return failZod(parsed.error);
    const exercice = parsed.data.exercice ?? String(new Date().getUTCFullYear());
    const format = formatDemande(url);
    if (format !== "json") {
      const { entetes, lignes } = await exporterGrandLivre(ctx, exercice, format);
      return reponseExport(format, `grand-livre-${exercice}`, entetes, lignes);
    }
    return ok(await obtenirGrandLivre(ctx, exercice));
  } catch (e) {
    const m = mapErreurRapports(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
