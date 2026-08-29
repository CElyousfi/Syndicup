/**
 * POST /v1/incidents/upload-url — URL signée d'upload d'UNE photo de signalement vers le
 * bucket privé `documents` (préfixe `<copropriete>/incidents/`). Rôles : tout rôle autorisé
 * à créer un incident (Doc A §5). Le client téléverse directement au Storage (exception
 * d'architecture autorisée, Master Spec Partie 9.3) puis référence le `storage_path`
 * retourné dans POST /incidents (champ `photos`).
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { incidentUploadUrlSchema } from "../../../../lib/incidents/schemas";
import { preparerUploadPhoto, PermissionRefuseeError } from "../../../../lib/incidents/incidents";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = incidentUploadUrlSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const resultat = await preparerUploadPhoto(ctx, parsed.data);
    return ok(resultat, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
