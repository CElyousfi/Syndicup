/**
 * GET/POST /v1/incidents — liste et création d'incidents (Master Spec Partie 2.2, Doc A §5 — M7).
 */
import { withApiHandler } from "../../../lib/http/handler";
import { formatDemande, reponseExport } from "../../../lib/http/export";
import { exporterIncidents } from "../../../lib/rapports/exports";
import { mapErreurRapports } from "../../../lib/rapports/http";
import { incidentCreateSchema, incidentsFiltresSchema } from "../../../lib/incidents/schemas";
import {
  creerIncident,
  listerIncidents,
  PermissionRefuseeError,
  IncidentIntrouvableError,
  LcdError,
} from "../../../lib/incidents/incidents";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../lib/http/respond";
import { readIdempotencyKeyOptionnelle } from "../../../lib/http/idempotency";

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
    // Filtres serveur (Zod) : statut (multi, virgules ou paramètre répété), urgence, categorie,
    // lot_id, q — `meta.total` reflète le filtre. Valeur invalide → 400, jamais ignorée.
    const brut: Record<string, string> = {};
    const statuts = url.searchParams.getAll("statut").join(",");
    if (statuts) brut.statut = statuts;
    for (const k of ["urgence", "categorie", "lot_id", "q"] as const) {
      const v = url.searchParams.get(k);
      if (v !== null && v !== "") brut[k] = v;
    }
    const filtres = incidentsFiltresSchema.safeParse(brut);
    if (!filtres.success) return failZod(filtres.error);
    const { total, rows } = await listerIncidents(ctx, page, limit, { sejourId: sejourValide, ...filtres.data });
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
    // Idempotency-Key optionnelle (anciens clients sans clé : comportement inchangé).
    const incident = await creerIncident(ctx, parsed.data, readIdempotencyKeyOptionnelle(req));
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
