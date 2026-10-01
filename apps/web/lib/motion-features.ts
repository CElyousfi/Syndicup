/**
 * Fonctionnalités d'animation (layout, glisser, gestes) chargées APRÈS l'hydratation par
 * <LazyMotion features={loadMotionFeatures}> : le premier rendu de la coque n'attend pas ce
 * paquet, les animations s'activent dès qu'il est arrivé.
 */
import { domMax } from "motion/react";

export default domMax;
