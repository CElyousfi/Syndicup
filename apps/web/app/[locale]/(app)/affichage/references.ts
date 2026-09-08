import { apiFetch } from "../../../../lib/api/client";
import type { Lot } from "../../../../lib/api/types";

/** Bâtiments connus (lot.batiment) — cible de l'audience BATIMENT. */
export async function batimentsConnus(): Promise<string[]> {
  const lots = await apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } });
  if (!lots.ok) return [];
  return [...new Set(lots.data.map((l) => l.batiment).filter((b): b is string => Boolean(b)))].sort();
}
