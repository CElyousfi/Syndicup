/**
 * Transition d'entrée de page — le template est remonté à CHAQUE navigation
 * (contrairement au layout), ce qui rejoue l'animation d'apparition : la
 * navigation entière respire, sans JavaScript supplémentaire.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-in-up">{children}</div>;
}
