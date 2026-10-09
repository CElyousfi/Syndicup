/**
 * Comportements « Alive » chargés À LA DEMANDE, regroupés en UN seul module différé (un seul
 * fragment JS, une seule entrée dans la table du runtime) : rien de tout cela ne pèse sur le
 * premier chargement des pages publiques (D5).
 */
export { haptic } from "./haptics";
export { annoncer } from "./form-result";
export { suivreGlisser } from "../../components/ui/modal-drag";
