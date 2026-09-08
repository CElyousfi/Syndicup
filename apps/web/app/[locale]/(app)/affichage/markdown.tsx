import type { ReactNode } from "react";

/**
 * Rendu du Markdown restreint des annonces (assaini côté API : l'HTML y est déjà échappé) —
 * gras, italique, listes, liens http(s), paragraphes. Aucun `dangerouslySetInnerHTML`.
 */
function inline(texte: string, cle: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  const brut = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  while ((m = re.exec(texte)) !== null) {
    if (m.index > last) out.push(brut(texte.slice(last, m.index)));
    if (m[1] && m[2]) out.push(<a key={`${cle}-${i++}`} href={m[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-action underline">{brut(m[1])}</a>);
    else if (m[3]) out.push(<strong key={`${cle}-${i++}`}>{brut(m[3])}</strong>);
    else if (m[4]) out.push(<em key={`${cle}-${i++}`}>{brut(m[4])}</em>);
    last = m.index + m[0].length;
  }
  if (last < texte.length) out.push(brut(texte.slice(last)));
  return out;
}

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const blocs: ReactNode[] = [];
  const lignes = source.split("\n");
  let liste: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (liste.length) { blocs.push(<ul key={`ul-${blocs.length}`} className="ms-5 list-disc space-y-1">{liste.map((l, i) => <li key={i}>{inline(l, `li-${blocs.length}-${i}`)}</li>)}</ul>); liste = []; }
    if (para.length) { blocs.push(<p key={`p-${blocs.length}`}>{para.map((l, i) => <span key={i}>{i > 0 ? <br /> : null}{inline(l, `p-${blocs.length}-${i}`)}</span>)}</p>); para = []; }
  };
  for (const l of lignes) {
    const item = /^\s*[-+*]\s+(.*)$/.exec(l);
    if (item) { if (para.length) flush(); liste.push(item[1] ?? ""); continue; }
    if (l.trim() === "") { flush(); continue; }
    if (liste.length) flush();
    para.push(l);
  }
  flush();
  return <div className={`space-y-3 text-[14px] leading-relaxed text-ink-strong ${className}`}>{blocs}</div>;
}
