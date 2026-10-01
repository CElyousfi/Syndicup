/**
 * Transition d'entrée de page — le template est remonté à CHAQUE navigation
 * (contrairement au layout). Fondu court ici ; la racine de chaque page
 * (`.page-root`) fait ensuite arriver ses blocs l'un après l'autre (motion.css).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade">{children}</div>;
}
