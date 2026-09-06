"use client";

import { useRouter } from "next/navigation";
import { Select } from "../../../../components/ui/field";
import type { Dict, Locale } from "../../../../lib/i18n";
import type { TypeContrat } from "../../../../lib/api/types";

export function FiltreType({ dict, locale, statut, type }: { dict: Dict; locale: Locale; statut: string; type: string }) {
  const router = useRouter();
  const e = dict.enumsContrats;
  return (
    <Select aria-label={dict.contrats.typeFiltre} value={type} className="!h-9 w-auto" onChange={(ev) => {
      const u = new URLSearchParams();
      if (statut !== "TOUS") u.set("statut", statut);
      if (ev.target.value) u.set("type", ev.target.value);
      router.push(`/${locale}/contrats${u.toString() ? `?${u}` : ""}`);
    }}>
      <option value="">{dict.contrats.typeFiltre}</option>
      {(Object.keys(e.typeContrat) as TypeContrat[]).map((t) => <option key={t} value={t}>{e.typeContrat[t]}</option>)}
    </Select>
  );
}
