import type { CSSProperties } from "react";

/**
 * Compteur « odomètre » — chaque chiffre d'une valeur DÉJÀ FORMATÉE (montant, pourcentage,
 * compte) défile de 0 jusqu'à sa valeur à l'arrivée, puis d'une valeur à l'autre quand la donnée
 * change. Composant serveur, zéro JavaScript : bandes de chiffres + `@starting-style`.
 *
 * Aucune arithmétique : on ne parse jamais le nombre (règle « argent hors float »), on anime
 * les caractères de la chaîne telle que l'API/le formateur l'ont produite — la dernière image
 * est exactement le texte d'origine. Les jetons contenant des chiffres sont isolés en LTR
 * (un nombre se lit toujours de gauche à droite, même en arabe).
 */
export function Odometer({ value, className = "" }: { value: string; className?: string }) {
  if (!/\d/.test(value)) return <span className={className}>{value}</span>;
  let pos = 0;
  // Découpage sur l'espace ASCII seulement : les espaces insécables du formatage restent
  // dans le jeton (pas de retour à la ligne au milieu d'un montant).
  const tokens = value.split(/( )/);
  return (
    <span className={`odo ${className}`}>
      <span className="sr-only">{value}</span>
      <span aria-hidden>
        {tokens.map((tok, ti) => {
          if (tok === " " || !/\d/.test(tok)) return <span key={ti}>{tok}</span>;
          return (
            <span key={ti} className="odo-token" dir="ltr">
              {Array.from(tok).map((ch, ci) => {
                if (ch < "0" || ch > "9") return <span key={ci}>{ch}</span>;
                const style = { "--d": ch, "--p": pos++ } as CSSProperties;
                return (
                  <span key={ci} className="odo-digit" style={style}>
                    <span className="odo-ghost">{ch}</span>
                    <span className="odo-strip">
                      <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span>
                      <span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>
                    </span>
                  </span>
                );
              })}
            </span>
          );
        })}
      </span>
    </span>
  );
}
