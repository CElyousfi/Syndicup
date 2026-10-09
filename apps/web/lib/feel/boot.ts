/**
 * Script d'amorçage de la couche Alive, injecté en ligne dans <head> AVANT la première peinture
 * (aucun clignotement) — pose sur <html> :
 *   data-alive="1|0"      drapeau alive_v1 (serveur ; sinon dernière valeur de l'appareil ; sinon ON)
 *   data-motion="reduced" réglage Sensations « Réduites » (le système est géré par la media query)
 *   data-lite="1"         appareil modeste ou « économie de données » → pas d'effets d'ambiance
 * Toutes les lectures de stockage sont protégées (navigation privée, stockage bloqué).
 */
export const FEEL_STORAGE = {
  flag: "su.flag.alive_v1",
  prefs: "su.sensations",
} as const;

export function feelBootScript(): string {
  return `(function(){try{var d=document.documentElement,s=null;try{s=window.localStorage}catch(e){}
var src=d.getAttribute("data-alive-src");
if(s){try{if(src==="api"){s.setItem("${FEEL_STORAGE.flag}",d.getAttribute("data-alive")||"1")}else{var v=s.getItem("${FEEL_STORAGE.flag}");if(v==="0"||v==="1")d.setAttribute("data-alive",v)}}catch(e){}
try{var p=JSON.parse(s.getItem("${FEEL_STORAGE.prefs}")||"{}");if(p&&p.reducedMotion)d.setAttribute("data-motion","reduced")}catch(e){}}
var n=navigator,c=n.connection;if((n.deviceMemory&&n.deviceMemory<=2)||(n.hardwareConcurrency&&n.hardwareConcurrency<=2)||(c&&c.saveData))d.setAttribute("data-lite","1")
}catch(e){}})();`;
}
