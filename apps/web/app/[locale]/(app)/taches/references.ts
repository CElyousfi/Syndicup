import { apiFetch } from "../../../../lib/api/client";
import type { MembreCopropriete } from "../../../../lib/api/types";
import { nomComplet } from "../../../../lib/format";

/** Assignés possibles : syndic, conseil syndical, personnel (rôle GARDIEN) — actifs. */
export async function assigneesPossibles(): Promise<{ id: string; nom: string; role: string }[]> {
  const res = await apiFetch<MembreCopropriete[]>("/users", { searchParams: { limit: 200 } });
  if (!res.ok) return [];
  return res.data
    .map((m) => ({ id: m.id, nom: nomComplet(m) ?? m.email ?? m.telephone ?? m.id.slice(0, 8), role: m.roles.find((r) => r.actif && ["SYNDIC", "CONSEIL_SYNDICAL", "GARDIEN"].includes(r.role))?.role ?? "" }))
    .filter((m) => m.role)
    .sort((a, b) => a.role.localeCompare(b.role) || a.nom.localeCompare(b.nom));
}
