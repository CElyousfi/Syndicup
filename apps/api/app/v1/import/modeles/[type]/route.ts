/** GET /v1/import/modeles/{type} — modèle xlsx téléchargeable (en-têtes FR ou AR + ligne d'exemple), `?langue=fr|ar`. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { mapErreurImport } from "../../../../../lib/import/http";
import { TYPES_IMPORT, type TypeImport } from "../../../../../lib/import/schemas";
import { genererModele } from "../../../../../lib/import/parse";
import { fail } from "../../../../../lib/http/respond";
type P = { params: Promise<{ type: string }> };
async function handleGET(req: Request, { params }: P) {
  try {
    await tenantFromRequest(req);
    const { type } = await params;
    const t = type.replace(/\.xlsx$/i, "").toUpperCase();
    if (!(TYPES_IMPORT as readonly string[]).includes(t)) return fail("NOT_FOUND", "Modèle inconnu.");
    const langue = new URL(req.url).searchParams.get("langue") === "ar" ? "AR" : "FR";
    const buffer = await genererModele(t as TypeImport, langue);
    return new Response(new Uint8Array(buffer), { status: 200, headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="modele-${t.toLowerCase()}-${langue.toLowerCase()}.xlsx"`, "Cache-Control": "no-store" } });
  } catch (e) { const m = mapErreurImport(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
