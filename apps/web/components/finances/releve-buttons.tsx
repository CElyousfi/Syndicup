"use client";

/** Relevé de charges d'un lot (M18, « état daté ») — visionneuse intégrée FR / AR, choix de l'exercice. */
import { useState } from "react";
import { FileViewerButton } from "../documents/document-viewer";
import { Select } from "../ui/field";
import type { Dict } from "../../lib/i18n";

export function ReleveButtons({ dict, lotId, lotNumero }: { dict: Dict; lotId: string; lotNumero: string }) {
  const courant = new Date().getFullYear();
  const [exercice, setExercice] = useState(String(courant));
  const r = dict.rapports;
  const viewer = { see: dict.common.see, close: dict.common.close, download: dict.common.download };
  const src = (langue: "fr" | "ar") => `/api/releve-pdf?lot=${lotId}&exercice=${exercice}&langue=${langue}`;
  return (
    <div className="flex flex-wrap items-center gap-2" title={r.releveAide}>
      <Select aria-label={r.exercice} value={exercice} onChange={(e) => setExercice(e.target.value)} className="!h-9 w-auto tnum">
        {[0, 1, 2].map((i) => <option key={i} value={String(courant - i)}>{courant - i}</option>)}
      </Select>
      <FileViewerButton src={src("fr")} nom={`${r.releve} ${lotNumero} ${exercice} — FR.pdf`} labels={viewer} label={`${r.releveTelecharger} · ${r.pdfFr}`} />
      <FileViewerButton src={src("ar")} nom={`${r.releve} ${lotNumero} ${exercice} — AR.pdf`} labels={viewer} label={r.pdfAr} />
    </div>
  );
}
