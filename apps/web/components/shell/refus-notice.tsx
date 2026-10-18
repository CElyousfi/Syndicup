"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "../../lib/toast";

/**
 * Accès refusé par une garde de page (`exigerRole` → `?refus=1`) : on DIT pourquoi l'utilisateur
 * a atterri ici (« Vous n'avez pas accès à cette page »), une fois, puis on retire le drapeau de
 * l'URL (rafraîchir ne ré-annonce rien).
 */
export function RefusNotice({ message }: { message: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const refus = params.get("refus") === "1";
  useEffect(() => {
    if (!refus) return;
    toast({ titre: message, tone: "warn", duree: 6000 });
    const reste = new URLSearchParams(params.toString());
    reste.delete("refus");
    const q = reste.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [refus, message, params, pathname, router]);
  return null;
}
