/** POST /v1/invitations/envoyer-en-masse — envoi des invitations pré-remplies (SMS / EMAIL via transport) ou export csv « nom, téléphone, lien, lien WhatsApp » (WHATSAPP / CSV) ; audité. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { mapErreurImport } from "../../../../lib/import/http";
import { invitationsMasseSchema } from "../../../../lib/import/schemas";
import { envoyerInvitationsEnMasse, PermissionRefuseeError } from "../../../../lib/import/invitations-masse";
import { reponseExport } from "../../../../lib/http/export";
import { fail } from "../../../../lib/http/respond";
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = invitationsMasseSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    const r = await envoyerInvitationsEnMasse(ctx, parsed.data);
    if (parsed.data.canal === "CSV" || parsed.data.canal === "WHATSAPP") return reponseExport("csv", "invitations", r.entetes, r.lignes);
    return ok({ canal: r.canal, total: r.total, envoyees: r.envoyees, sans_contact: r.sans_contact, echouees: r.echouees });
  } catch (e) { if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message); const m = mapErreurImport(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
