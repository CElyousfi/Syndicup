/** GET /v1/rapports/exports — journal des exports (export_log, append-only) : qui a extrait quoi, quand. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok } from "../../../../lib/http/respond";
import { lirePagination, metaPagination } from "../../../../lib/http/pagination";
import { listerExportsJournal } from "../../../../lib/rapports/exports";
import { mapErreurRapports } from "../../../../lib/rapports/http";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const pagination = lirePagination(new URL(req.url));
    const { total, rows } = await listerExportsJournal(ctx, pagination);
    return ok(rows, { meta: metaPagination(total, pagination) });
  } catch (e) {
    const m = mapErreurRapports(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
