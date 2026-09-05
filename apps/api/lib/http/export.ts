/**
 * Export CSV partagé — M16 (formalisé en M18 avec `export_log`). Un seul encodeur pour tous les
 * endpoints de liste (`?format=csv`) :
 *   - UTF-8 avec BOM (Excel francophone ouvre correctement les accents), séparateur « ; », CRLF ;
 *   - toute cellule est échappée (guillemets doublés), les valeurs commençant par = + - @ sont
 *     neutralisées (injection de formule) ;
 *   - les montants sont des chaînes décimales (jamais un float) — l'appelant les fournit via
 *     lib/money.toApiString ;
 *   - flux (ReadableStream) : les lignes sont écrites au fil de l'itération, sans matérialiser
 *     tout le fichier en mémoire ;
 *   - chaque export est journalisé par l'appelant (audit_log `*_EXPORTEES` en M16 ; table
 *     `export_log` dédiée en M18 — même signature, seule la destination change).
 */
import type { TenantContext } from "../tenant/context";
import type { TenantDb } from "../tenant/db";
import { ecrireAuditLog } from "../audit/audit";

export type FormatListe = "json" | "csv";

export function formatDemande(url: URL): FormatListe {
  return url.searchParams.get("format") === "csv" ? "csv" : "json";
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

const BOM = "\uFEFF";

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
  const nom = nomFichier.replace(/[^A-Za-z0-9._-]+/g, "-");
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Journalise un export (qui, quoi, combien de lignes, filtres) — CNDP : traçabilité des extractions. */
export async function journaliserExport(
  db: TenantDb,
  ctx: TenantContext,
  params: { type: string; filtres: Record<string, unknown>; nbLignes: number }
) {
  await ecrireAuditLog(db, {
    coproprieteId: ctx.coproprieteId,
    acteurId: ctx.utilisateurId,
    action: `${params.type}_EXPORTEES`,
    entite: "export",
    entiteId: ctx.coproprieteId,
    apres: { type: params.type, filtres: params.filtres, nb_lignes: params.nbLignes } as never,
  });
}
