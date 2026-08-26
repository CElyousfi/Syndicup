/**
 * GET/POST /v1/documents — liste (filtrée par visibilite via RLS) et création (Master Spec
 * Partie 9, Doc A §12.3 — M9).
 */
import { withApiHandler } from "../../../lib/http/handler";
import { documentCreateSchema } from "../../../lib/documents/schemas";
import {
  creerDocument,
  listerDocuments,
  PermissionRefuseeError,
} from "../../../lib/documents/documents";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const rows = await listerDocuments(ctx);
    return ok(rows);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = documentCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const document = await creerDocument(ctx, parsed.data);
    return ok(document, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
