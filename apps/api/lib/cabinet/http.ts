/** Mapping erreurs → réponses HTTP — M25 Cabinet ; résolution de l'acteur (JWT seul, sans copropriété). */
import { fail } from "../http/respond";
import { mapAuthError, bearerToken, UnauthenticatedError } from "../http/request-context";
import { verifyJwt } from "../tenant/jwt";
import { setRequestIdentity } from "../http/request-context-storage";
import { CabinetError, IntrouvableError, PermissionRefuseeError, type Acteur } from "./cabinet";

export async function acteurFromRequest(req: Request): Promise<Acteur> {
  const token = bearerToken(req);
  if (!token) throw new UnauthenticatedError("Header Authorization: Bearer manquant.");
  const payload = await verifyJwt(token);
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (!sub) throw new UnauthenticatedError("JWT sans sub.");
  const roles = Array.isArray(payload.roles) ? (payload.roles as { role?: string }[]) : [];
  setRequestIdentity(sub);
  return { utilisateurId: sub, superAdmin: roles.some((r) => r.role === "SUPER_ADMIN") };
}
export function mapErreurCabinet(e: unknown): Response | null {
  const m = mapAuthError(e);
  if (m) return m;
  if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
  if (e instanceof CabinetError) return fail(e.code, e.message);
  return null;
}
