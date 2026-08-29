/**
 * Export CSV de la comptabilité — calculé côté serveur avec les mêmes dérivations que la page
 * (jamais de float ; centimes BigInt). Session par cookies, périmètre RLS de l'appelant :
 * un résident n'exporte que ses lots. UTF-8 + BOM, séparateur « ; » (Excel francophone).
 *   GET /api/finances-csv?type=mois|lots|paiements&exercice=YYYY&locale=fr|ar
 */
import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api/client";
import { readSession } from "../../../lib/session";
import { getDict, isLocale } from "../../../lib/i18n";
import { formatDateHeure, formatPeriode } from "../../../lib/format";
import type { Paiement } from "../../../lib/api/types";
import { getLots, getSynthese } from "../../../lib/finances-data";
import { csv, exercice, journalPaiements, montantCsv, parLot, parMois } from "../../../lib/comptabilite";

export async function GET(req: NextRequest) {
  const session = await readSession();
  if (!session.accessToken) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") ?? "mois";
  const annee = sp.get("exercice") ?? "";
  const locale = isLocale(sp.get("locale") ?? "") ? (sp.get("locale") as "fr" | "ar") : "fr";
  if (!/^\d{4}$/.test(annee) || !["mois", "lots", "paiements"].includes(type)) {
    return NextResponse.json({ error: "paramètres invalides" }, { status: 400 });
  }
  const dict = getDict(locale);
  const c = dict.comptabilite;

  const [synthese, lots, paiementsRes] = await Promise.all([
    getSynthese(),
    getLots(),
    apiFetch<Paiement[]>("/finances/paiements", { searchParams: { exercice: annee } }),
  ]);
  const e = exercice(synthese, paiementsRes.ok ? paiementsRes.data : [], annee);

  let lignes: Array<Array<string | number | null>>;
  if (type === "mois") {
    const rows = parMois(e);
    lignes = [
      [c.colMois, c.colAppels, c.appele, c.encaisse, c.restant, c.taux],
      ...rows.map((r) => [formatPeriode(r.periode, locale), r.nbAppels, montantCsv(r.du), montantCsv(r.paye), montantCsv(r.restant), `${Math.round(r.taux * 100)}%`]),
    ];
    const t = rows.reduce((acc, r) => ({ du: acc.du + r.du, paye: acc.paye + r.paye }), { du: 0n, paye: 0n });
    lignes.push([c.total, rows.reduce((n, r) => n + r.nbAppels, 0), montantCsv(t.du), montantCsv(t.paye), montantCsv(t.du - t.paye), ""]);
  } else if (type === "lots") {
    const rows = parLot(e, lots);
    lignes = [
      [c.colLot, dict.lots.type, c.appele, c.encaisse, c.restant, c.colEscalade, c.colDernierPaiement],
      ...rows.map((r) => [
        r.numero,
        r.typeLot ? dict.enums.typeLot[r.typeLot] : "",
        montantCsv(r.du),
        montantCsv(r.paye),
        montantCsv(r.restant),
        r.restant > 0n ? dict.enums.escalade[r.escalade] : c.aJour,
        r.dernierPaiement ? formatDateHeure(r.dernierPaiement, locale) : "",
      ]),
    ];
  } else {
    const rows = journalPaiements(e, synthese, lots);
    lignes = [
      [c.colDate, c.colLot, c.colPeriode, dict.lots.type, c.colMethode, c.colMontant, c.colReference],
      ...rows.map((r) => [
        formatDateHeure(r.horodatage, locale),
        r.lotNumero,
        r.periode ? formatPeriode(r.periode, locale) : "",
        r.typeAppel ? dict.enums.typeAppel[r.typeAppel] : "",
        dict.enums.methodePaiement[r.methode],
        montantCsv(r.montantC),
        r.referenceCmi ?? "",
      ]),
    ];
  }

  const nomFichier = `syndicup-${type}-${annee}.csv`;
  return new NextResponse(csv(lignes), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
