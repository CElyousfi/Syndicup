/**
 * Glisser-pour-fermer de la feuille du bas (< md) — chargé à l'ouverture d'une modale, jamais
 * dans le premier chargement des pages (D5). Vers le bas : suit le doigt, ferme au-delà de
 * 120 px ou d'un geste vif ; vers le haut : résistance ; sinon retour en ressort (CSS).
 */
export function suivreGlisser(e: PointerEvent, cible: HTMLElement, dialog: HTMLDialogElement, onClose: () => void) {
  if (!window.matchMedia("(max-width: 767px)").matches || document.documentElement.dataset.alive === "0") return;
  if ((e.target as Element | null)?.closest("button")) return; // le bouton Fermer reste un simple clic
  const y0 = e.clientY;
  const t0 = performance.now();
  let dy = 0;
  cible.setPointerCapture(e.pointerId);
  dialog.setAttribute("data-dragging", "");
  const move = (ev: PointerEvent) => {
    const raw = ev.clientY - y0;
    dy = raw < 0 ? -Math.sqrt(-raw) * 2 : raw;
    dialog.style.transform = `translateY(${dy}px)`;
  };
  const fin = () => {
    cible.removeEventListener("pointermove", move);
    cible.removeEventListener("pointerup", fin);
    cible.removeEventListener("pointercancel", fin);
    dialog.removeAttribute("data-dragging");
    dialog.style.transform = "";
    if (dy > 120 || dy / Math.max(1, performance.now() - t0) > 0.6) onClose();
  };
  cible.addEventListener("pointermove", move);
  cible.addEventListener("pointerup", fin);
  cible.addEventListener("pointercancel", fin);
}
