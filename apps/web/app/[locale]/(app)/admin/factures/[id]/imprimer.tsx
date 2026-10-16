"use client";

import { Button } from "../../../../../../components/ui/button";
import { IconPrinter } from "../../../../../../components/ui/icons";

/** Impression native : « Enregistrer en PDF » du navigateur donne la facture PDF. */
export function BoutonImprimer({ label }: { label: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      <IconPrinter width={16} height={16} />
      {label}
    </Button>
  );
}
