/**
 * GET/POST /v1/espaces-communs — liste et création (Master Spec Partie 2.2/9.4, Doc A §7 — M8).
 */
import { espaceCommunCreateSchema } from "../../../lib/espaces-communs/schemas";
import {
  creerEspaceCommun,
  listerEspacesCommuns,
  PermissionRefuseeError,
} from "../../../lib/espaces-communs/espaces-communs";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../lib/http/respond";

export async function GET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const rows = await listerEspacesCommuns(ctx);
    return ok(rows);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = espaceCommunCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const espace = await creerEspaceCommun(ctx, parsed.data);
    return ok(espace, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}
