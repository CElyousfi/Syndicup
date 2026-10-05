"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { celebrate, type SuccessInput } from "../../lib/success";

/**
 * Écran de succès après une action MAJEURE qui redirige (création serveur → page de détail avec
 * un drapeau d'URL, ex. `?signale=1`) : s'annonce une seule fois puis retire le drapeau de l'URL,
 * pour qu'un rechargement ou un retour arrière ne le rejoue pas.
 */
export function CelebrateOnce(props: SuccessInput) {
  const fait = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (fait.current) return;
    fait.current = true;
    celebrate(props);
    router.replace(pathname, { scroll: false });
  }, [props, router, pathname]);
  return null;
}
