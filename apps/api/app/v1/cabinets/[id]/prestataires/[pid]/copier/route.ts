/** POST /v1/cabinets/{id}/prestataires/{pid}/copier — copie le modèle dans une copropriété du portefeuille (ligne propre, RLS par copropriété). */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import { ok, failZod } from "../../../../../../../lib/http/respond";
import { acteurFromRequest, mapErreurCabinet } from "../../../../../../../lib/cabinet/http";
import { prestataireCopierSchema } from "../../../../../../../lib/cabinet/schemas";
import { copierPrestataire } from "../../../../../../../lib/cabinet/cabinet";
type P = { params: Promise<{ id: string; pid: string }> };
async function handlePOST(req: Request, { params }: P) {
  try {
    const { id, pid } = await params;
    const parsed = prestataireCopierSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await copierPrestataire(await acteurFromRequest(req), id, pid, parsed.data.copropriete_id), { status: 201 });
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
