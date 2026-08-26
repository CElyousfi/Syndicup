/**
 * GET /v1/documents/:id/download-url — génère une URL signée à durée de vie courte (Master Spec
 * Partie 9.3 — M9). Ajout nécessaire : le tableau littéral d'endpoints ne détaille pas de route
 * de téléchargement dédiée, mais Partie 9.3 exige explicitement de ne jamais exposer d'URL
 * Supabase Storage publique — un endpoint qui vérifie permission/RLS avant de signer est requis.
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import {
  obtenirUrlTelechargement,
  PermissionRefuseeError,
  IntrouvableError,
} from "../../../../../lib/documents/documents";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../lib/http/respond";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const { url } = await obtenirUrlTelechargement(ctx, id);
    return ok({ url });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
