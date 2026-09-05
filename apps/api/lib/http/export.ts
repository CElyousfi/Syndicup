/**
 * Export partagé CSV / XLSX — M16 (CSV), formalisé en M18 (`export_log`, XLSX). Un seul encodeur
 * pour tous les endpoints de liste (`?format=csv|xlsx`) :
 *   - CSV : UTF-8 avec BOM (Excel francophone ouvre correctement les accents), séparateur « ; »,
 *     CRLF ; toute cellule est échappée (guillemets doublés), les valeurs commençant par = + - @
 *     sont neutralisées (injection de formule) ; flux (ReadableStream) écrit au fil de l'itération ;
 *   - XLSX : classeur `exceljs` (une feuille, en-têtes en gras, colonnes auto-dimensionnées), les
 *     cellules restent des chaînes (aucun montant converti en float par le tableur — les montants
 *     sont des chaînes décimales fournies par l'appelant via lib/money.toApiString) ;
 *   - chaque export est journalisé par l'appelant dans la table APPEND-ONLY `export_log`
 *     (CNDP : qui a extrait quelles données personnelles, quand, avec quels filtres — jamais les
 *     données elles-mêmes).
 */
import type { TenantContext } from "../tenant/context";
import type { TenantDb } from "../tenant/db";
import type { Prisma } from "@prisma/client";

export type FormatListe = "json" | "csv" | "xlsx";
export type FormatExport = Exclude<FormatListe, "json">;

export function formatDemande(url: URL): FormatListe {
  const f = url.searchParams.get("format");
  return f === "csv" || f === "xlsx" ? f : "json";
}

export type CelluleCsv = string | number | boolean | null | undefined;

export function celluleCsv(v: CelluleCsv): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "boolean" ? (v ? "oui" : "non") : String(v);
  // Neutralisation des formules (Excel/LibreOffice interprètent = + - @ en début de cellule).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function ligneCsv(cellules: CelluleCsv[]): string {
  return cellules.map(celluleCsv).join(";") + "\r\n";
}

const BOM = "﻿";

function nomSur(nomFichier: string): string {
  return nomFichier.replace(/[^A-Za-z0-9._-]+/g, "-");
}

/**
 * Réponse CSV en flux. `lignes` peut être un tableau ou un itérateur asynchrone (pagination
 * interne côté service pour les gros exports).
 */
export function reponseCsv(
  nomFichier: string,
  entetes: string[],
  lignes: Iterable<CelluleCsv[]> | AsyncIterable<CelluleCsv[]>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(BOM + ligneCsv(entetes)));
      for await (const l of lignes as AsyncIterable<CelluleCsv[]>) {
        controller.enqueue(encoder.encode(ligneCsv(l)));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomSur(nomFichier)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Cellule XLSX : les valeurs « formule » sont neutralisées comme en CSV, tout reste texte. */
function celluleXlsx(v: CelluleCsv): string | number | boolean {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "oui" : "non";
  if (typeof v === "number") return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** Classeur XLSX (une feuille) — construit en mémoire ; les exports sont bornés par l'appelant. */
export async function bufferXlsx(
  feuille: string,
  entetes: string[],
  lignes: Iterable<CelluleCsv[]> | AsyncIterable<CelluleCsv[]>
): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "SyndicUp";
  const ws = wb.addWorksheet(feuille.slice(0, 31) || "Export");
  ws.addRow(entetes).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const largeurs = entetes.map((e) => e.length);
  for await (const l of lignes as AsyncIterable<CelluleCsv[]>) {
    const cellules = l.map(celluleXlsx);
    ws.addRow(cellules);
    cellules.forEach((c, i) => {
      const len = String(c).length;
      if (len > (largeurs[i] ?? 0)) largeurs[i] = len;
    });
  }
  ws.columns.forEach((col, i) => {
    col.width = Math.min(60, Math.max(8, (largeurs[i] ?? 8) + 2));
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function reponseXlsx(
  nomFichier: string,
  entetes: string[],
  lignes: Iterable<CelluleCsv[]> | AsyncIterable<CelluleCsv[]>
): Promise<Response> {
  const buffer = await bufferXlsx(nomFichier.replace(/\.(xlsx|csv)$/i, ""), entetes, lignes);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomSur(nomFichier)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** CSV ou XLSX selon `format` — `nomBase` sans extension. */
export function reponseExport(
  format: FormatExport,
  nomBase: string,
  entetes: string[],
  lignes: Iterable<CelluleCsv[]> | AsyncIterable<CelluleCsv[]>
): Promise<Response> | Response {
  return format === "xlsx" ? reponseXlsx(`${nomBase}.xlsx`, entetes, lignes) : reponseCsv(`${nomBase}.csv`, entetes, lignes);
}

/**
 * Journalise un export dans `export_log` (append-only, M18) — qui, quoi, combien de lignes, format et
 * filtres. `createMany` : pas de RETURNING, donc l'insertion réussit même pour un rôle dont la policy
 * SELECT ne montre pas la ligne (un propriétaire qui exporte le relevé de son lot).
 */
export async function journaliserExport(
  db: TenantDb,
  ctx: TenantContext,
  params: { type: string; filtres: Record<string, unknown>; nbLignes: number; format?: string }
) {
  await db.exportLog.createMany({
    data: [
      {
        coproprieteId: ctx.coproprieteId,
        utilisateurId: ctx.utilisateurId,
        type: params.type,
        filtresJson: { format: params.format ?? "csv", ...params.filtres } as Prisma.InputJsonValue,
        nbLignes: params.nbLignes,
      },
    ],
  });
}
