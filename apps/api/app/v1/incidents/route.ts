/**
 * GET/POST /v1/incidents — liste et création d'incidents (Master Spec Partie 2.2, Doc A §5 — M7).
 */
import { withApiHandler } from "../../../lib/http/handler";
import { formatDemande, reponseExport } from "../../../lib/http/export";
import { exporterIncidents } from "../../../lib/rapports/exports";
import { mapErreurRapports } from "../../../lib/rapports/http";
import { incidentCreateSchema } from "../../../lib/incidents/schemas";
import {
  creerIncident,
  listerIncidents,
  PermissionRefuseeError,
  IncidentIntrouvableError,
  LcdError,
} from "../../../lib/incidents/incidents";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
    const sejourId = url.searchParams.get("sejour_id");
    const sejourValide = sejourId && /^[0-9a-f-]{36}$/i.test(sejourId) ? sejourId : undefined;
    // M18 — export journalisé (export_log) : ?format=csv|xlsx.
    const format = formatDemande(url);
    if (format !== "json") {
      const { entetes, lignes } = await exporterIncidents(ctx, { sejour_id: sejourValide }, format);
      return reponseExport(format, "incidents", entetes, lignes);
    }
    const { total, rows } = await listerIncidents(ctx, page, limit, { sejourId: sejourValide });
    return ok(rows, { meta: { total, page, has_more: page * limit < total } });
  } catch (e) {
    const rapports = mapErreurRapports(e);
    if (rapports) return rapports;
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
    const parsed = incidentCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const incident = await creerIncident(ctx, parsed.data);
    return ok(incident, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IncidentIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof LcdError) return fail(e.code, e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
