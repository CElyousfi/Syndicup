/**
 * Envoi en masse des invitations (M24) — les invitations créées par un import ne partent jamais
 * seules : le syndic choisit le canal. SMS / EMAIL : transport de notification (identité pré-remplie,
 * sans compte) ; WHATSAPP / CSV : fichier « nom, téléphone, e-mail, lien, lien WhatsApp » pour un envoi
 * manuel (aucun agrégateur). `envoyee_le` posé ; audit `INVITATIONS_ENVOI_MASSE`.
 */
import { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { render } from "../notifications/templates";
import { transportPour } from "../notifications/transports";
import type { InvitationsMasseInput } from "./schemas";

export class PermissionRefuseeError extends Error {}

export function lienInvitation(code: string, langue: "FR" | "AR" = "FR") {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.syndicup.ma").replace(/\/$/, "");
  return `${base}/${langue.toLowerCase()}/invitation/${encodeURIComponent(code)}`;
}

export const ENTETES_INVITATIONS = ["nom", "prenom", "telephone", "email", "role", "lot", "code", "lien", "lien_whatsapp", "expire_le"];
export async function envoyerInvitationsEnMasse(ctx: TenantContext, input: InvitationsMasseInput) {
  if (can("onboarding.inviter", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic envoie les invitations.");
  return withTenant(ctx, async (db) => {
    const copro = await db.copropriete.findUnique({ where: { id: ctx.coproprieteId }, select: { nom: true } });
    const invitations = await db.invitation.findMany({
      where: { coproprieteId: ctx.coproprieteId, statut: "EN_ATTENTE", expireLe: { gt: new Date() }, ...(input.invitation_ids?.length ? { id: { in: input.invitation_ids } } : input.import_job_id ? { importJobId: input.import_job_id } : { envoyeeLe: null, preRempliJson: { not: Prisma.DbNull } }) },
      include: { lot: { select: { numero: true } } },
      orderBy: { creeLe: "asc" },
    });
    const lignes: (string | number)[][] = [];
    let envoyees = 0, sansContact = 0, echouees = 0;
    const transport = input.canal === "SMS" || input.canal === "EMAIL" ? transportPour(input.canal) : null;
    for (const inv of invitations) {
      const j = (inv.preRempliJson ?? {}) as Record<string, unknown>;
      const langue = j.langue === "AR" ? "AR" : "FR";
      const lien = lienInvitation(inv.code, langue);
      const telephone = typeof j.telephone === "string" ? j.telephone : null;
      const email = typeof j.email === "string" ? j.email : null;
      const nom = `${j.prenom ?? ""} ${j.nom ?? ""}`.trim();
      const rendu = render("INVITATION_ENVOI", langue, { residence: copro?.nom ?? "", nom, lien, lot: inv.lot?.numero ?? "" });
      const wa = telephone ? `https://wa.me/${telephone.replace(/^\+/, "")}?text=${encodeURIComponent(`${rendu.titre}\n${rendu.corps}`)}` : "";
      lignes.push([String(j.nom ?? ""), String(j.prenom ?? ""), telephone ?? "", email ?? "", inv.roleCible, inv.lot?.numero ?? "", inv.code, lien, wa, inv.expireLe.toISOString().slice(0, 10)]);
      if (transport) {
        const dest = input.canal === "SMS" ? telephone : email;
        if (!dest) { sansContact++; continue; }
        try {
          const r = await transport.envoyer({ destinataire: { utilisateurId: inv.id, email, telephone }, titre: rendu.titre, corps: rendu.corps, langue, templateCode: "INVITATION_ENVOI", donnees: { lien, code: inv.code } });
          if (r.statut === "ECHOUE") { echouees++; continue; }
        } catch { echouees++; continue; }
      }
      await db.invitation.update({ where: { id: inv.id }, data: { envoyeeLe: new Date() } });
      envoyees++;
    }
    await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action: "INVITATIONS_ENVOI_MASSE", entite: "invitation", entiteId: input.import_job_id ?? "00000000-0000-0000-0000-000000000000", apres: { canal: input.canal, total: invitations.length, envoyees, sans_contact: sansContact, echouees } });
    return { canal: input.canal, total: invitations.length, envoyees, sans_contact: sansContact, echouees, entetes: ENTETES_INVITATIONS, lignes };
  });
}
