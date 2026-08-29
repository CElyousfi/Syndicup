"use client";

import { Button } from "../../../../../../components/ui/button";
import { IconPrinter } from "../../../../../../components/ui/icons";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
      <IconPrinter width={16} height={16} />
      {label}
    </Button>
  );
}
