"use client";

import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";

/**
 * Liste VIVANTE (couche Alive) : les enfants CLÉS qui apparaissent après le premier rendu
 * (actualisation live, `router.refresh()`, action) se déplient avec un surlignage bref ; ceux qui
 * disparaissent se replient avant d'être retirés. Premier rendu sans animation (la cascade
 * d'entrée `.page-root` / `.stagger-rows` s'en charge). Marche pour des <tr> comme pour des <li>
 * ou des <div> : on pose `data-live` sur l'élément, le CSS (motion.css) fait le reste.
 *
 *   <LiveList as="tbody">{lignes.map((l) => <TR key={l.id}>…</TR>)}</LiveList>
 */
type Tag = "tbody" | "ul" | "ol" | "div";

export function LiveList({ as = "div", className, children }: { as?: Tag; className?: string; children: ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<Record<string, unknown>>[];
  const keys = items.map((c) => String(c.key));
  const vus = useRef<Set<string> | null>(null);
  const precedents = useRef<Map<string, ReactElement<Record<string, unknown>>>>(new Map());
  const [sortants, setSortants] = useState<Array<{ key: string; el: ReactElement<Record<string, unknown>>; index: number }>>([]);
  const premier = vus.current === null;
  const nouveaux = premier ? new Set<string>() : new Set(keys.filter((k) => !vus.current!.has(k)));

  useEffect(() => {
    const actifs = document.documentElement.dataset.alive !== "0";
    const avant = precedents.current;
    const maintenant = new Set(keys);
    if (vus.current && actifs) {
      const partis: typeof sortants = [];
      let i = 0;
      for (const [k, el] of avant) {
        if (!maintenant.has(k)) partis.push({ key: k, el, index: i });
        i++;
      }
      if (partis.length) {
        setSortants(partis);
        const t = window.setTimeout(() => setSortants([]), 420);
        vus.current = maintenant;
        precedents.current = new Map(items.map((c) => [String(c.key), c]));
        return () => window.clearTimeout(t);
      }
    }
    vus.current = maintenant;
    precedents.current = new Map(items.map((c) => [String(c.key), c]));
    // Dépendance : la signature des clés résume la liste (les éléments eux-mêmes changent à chaque rendu).
  }, [keys.join("|")]);

  const rendus: ReactNode[] = items.map((c) => (nouveaux.has(String(c.key)) ? cloneElement(c, { "data-live": "in" }) : c));
  for (const s of sortants) rendus.splice(Math.min(s.index, rendus.length), 0, cloneElement(s.el, { key: `out-${s.key}`, "data-live": "out", "aria-hidden": true }));

  const Comp = as;
  return <Comp className={className}>{rendus}</Comp>;
}
