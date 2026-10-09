/**
 * Moments signature (couche Alive, docs/ALIVE_GUIDE.md §4) — mouvement + haptique + son,
 * ≤ 1,2 s, passables d'un clic, JAMAIS bloquants. Événement DOM, aucun contexte React :
 * <SignatureOverlay/> (coque) les joue. Toujours APRÈS la réponse 2xx du serveur.
 *
 *   signature({ kind: "annexes" })             ← l'UNIQUE appel du futur module comptable
 *   signature({ kind: "payment", amount, balanceBefore, balanceAfter })
 *   signature({ kind: "sent" })   signature({ kind: "vote" })   signature({ kind: "justified", receiptUrl })
 */
export type SignatureInput =
  | { kind: "annexes"; titles?: string[] }
  | { kind: "payment"; amount: string; balanceBefore?: string; balanceAfter?: string }
  | { kind: "sent"; label?: string }
  | { kind: "vote"; label?: string }
  | { kind: "justified"; receiptUrl?: string; title?: string }
  | { kind: "welcome" };

export const SIGNATURE_EVENT = "su:signature";

export function signature(input: SignatureInput) {
  if (typeof window === "undefined") return;
  if (document.documentElement.dataset.alive === "0") return;
  window.dispatchEvent(new CustomEvent<SignatureInput>(SIGNATURE_EVENT, { detail: input }));
}

/** Vrai la première fois pour [cle] sur cet appareil (halo « résidence à jour », bienvenue). */
export function unePremiereFois(cle: string): boolean {
  try {
    const k = `su.once.${cle}`;
    if (window.localStorage.getItem(k)) return false;
    window.localStorage.setItem(k, "1");
    return true;
  } catch {
    return false;
  }
}
