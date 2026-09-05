"use client";

import { useRouter } from "next/navigation";
import { Input, Select } from "../../../../../components/ui/field";
import type { Dict, Locale } from "../../../../../lib/i18n";

/** Filtres de liste (état dans l'URL — partageable, pagination cohérente). */
export function FiltresDepenses({
  dict,
  locale,
  valeurs,
}: {
  dict: Dict;
  locale: Locale;
  valeurs: { exercice: string; categorie: string; source: string; q: string; statut: string };
}) {
  const router = useRouter();
  const d = dict.depenses;
  const e = dict.enumsDepenses;
  const annee = new Date().getFullYear();
  const exercices = [annee + 1, annee, annee - 1, annee - 2].map(String);
  if (!exercices.includes(valeurs.exercice)) exercices.push(valeurs.exercice);

  const appliquer = (fd: FormData) => {
    const u = new URLSearchParams();
    for (const k of ["exercice", "categorie", "source", "q", "statut"]) {
      const v = String(fd.get(k) ?? "").trim();
      if (v) u.set(k, v);
    }
    router.push(`/${locale}/finances/depenses?${u.toString()}`);
  };

  return (
    <form
      className="filters mb-4 grid gap-2 sm:grid-cols-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        appliquer(new FormData(ev.currentTarget));
      }}
      onChange={(ev) => {
        const t = ev.target as HTMLElement;
        if (t.tagName === "SELECT") appliquer(new FormData(ev.currentTarget));
      }}
    >
      <input type="hidden" name="statut" value={valeurs.statut} />
      <Select name="exercice" defaultValue={valeurs.exercice} aria-label={d.exercice}>
        {exercices.sort().reverse().map((x) => (
          <option key={x} value={x}>{d.exercice} {x}</option>
        ))}
      </Select>
      <Select name="categorie" defaultValue={valeurs.categorie} aria-label={d.categorie}>
        <option value="">{d.categorie} · {d.tous}</option>
        {(Object.keys(e.categorieDepense) as Array<keyof typeof e.categorieDepense>).map((c) => (
          <option key={c} value={c}>{e.categorieDepense[c]}</option>
        ))}
      </Select>
      <Select name="source" defaultValue={valeurs.source} aria-label={d.source}>
        <option value="">{d.source} · {d.tous}</option>
        {(Object.keys(e.sourceFinancement) as Array<keyof typeof e.sourceFinancement>).map((s) => (
          <option key={s} value={s}>{e.sourceFinancement[s]}</option>
        ))}
      </Select>
      <Input name="q" type="search" defaultValue={valeurs.q} placeholder={d.rechercher} aria-label={dict.common.search} />
    </form>
  );
}
