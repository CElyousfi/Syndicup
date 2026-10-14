"use client";

/**
 * Dari — l'assistant de l'application, présent sur chaque écran.
 *
 *  - Lanceur flottant (au-dessus de la barre d'onglets sur mobile) avec la tête animée de Dari ;
 *    une pastille signale les repères « attention » (charges en retard, SLA dépassé…).
 *  - Panneau : repères du moment (calculés côté API sur les données de l'utilisateur, filtrées
 *    par rôle + RLS), questions proposées, conversation. Dari connaît l'écran ouvert et propose
 *    des écrans où agir (toujours autorisés pour le rôle — revalidés par l'API).
 *  - `window.dispatchEvent(new CustomEvent(ASK_DARI, { detail: { question } }))` ouvre Dari et
 *    pose la question (utilisé par la visite guidée).
 *
 * Le navigateur ne parle qu'aux proxys /api/assistant* (jeton httpOnly). FR/AR, RTL par
 * propriétés logiques. Rien n'est stocké côté serveur ; la conversation vit dans l'onglet.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AssistantEcran, AssistantEtat, AssistantInsight } from "../../lib/api/types";
import type { Dict } from "../../lib/i18n";
import { fill } from "../../lib/i18n";
import { IconButton, Pressable } from "../ui/pressable";
import { Textarea } from "../ui/field";
import { DariAvatar, DariMotion, preloadDari, type DariClip } from "./dari";

export const ASK_DARI = "su:ask-dari";
const CLE_INTRO = "syndicup:dari:intro";
const CLE_TOUR = "syndicup:onboarding:v2";
const CLE_CONV = "syndicup:dari:conv";
const CLE_ETAT = "syndicup:dari:etat";

type Labels = Dict["dari"];

interface Message {
  role: "user" | "assistant";
  contenu: string;
  ecrans?: AssistantEcran[];
  erreur?: boolean;
}

/** **gras**, retours à la ligne et liens d'écran [[cle|Libellé]] — rien d'autre n'est interprété (pas de HTML). */
function Texte({ texte, onEcran }: { texte: string; onEcran: (e: AssistantEcran) => void }) {
  const morceaux = texte.split(/(\*\*[^*]+\*\*|\[\[[a-z0-9_]+\|[^\]]+\]\])/g);
  return (
    <span className="whitespace-pre-line">
      {morceaux.map((m, i) => {
        if (m.startsWith("**") && m.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-ink">
              {m.slice(2, -2)}
            </strong>
          );
        }
        const lien = /^\[\[([a-z0-9_]+)\|([^\]|]+)\|([^\]|]*)\|([^\]|]*)\]\]$/.exec(m);
        if (lien) {
          return (
            <Pressable key={i} onClick={() => onEcran({ cle: lien[1]!, libelle: lien[2]!, web: lien[3]!, mobile: lien[4] || null })} className="mx-0.5 inline-flex items-center gap-1 rounded-full bg-action-tint px-2 py-0.5 align-baseline text-[13px] font-semibold text-brand-deep hover:bg-sage">
              {lien[2]}
              <span className="inline-block text-[11px] rtl:-scale-x-100" aria-hidden>→</span>
            </Pressable>
          );
        }
        return <span key={i}>{m}</span>;
      })}
    </span>
  );
}

const TON: Record<AssistantInsight["niveau"], string> = {
  attention: "bg-danger",
  info: "bg-link",
  succes: "bg-ok",
};

export function DariAssistant({ locale, labels, prenom, roleLabel }: { locale: "fr" | "ar"; labels: Labels; prenom: string; roleLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const [etat, setEtat] = useState<AssistantEtat | null>(null);
  const [etatErreur, setEtatErreur] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [phase, setPhase] = useState<"think" | "type">("think");
  const [heroClip, setHeroClip] = useState<DariClip>("wave");
  const [bulle, setBulle] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  // Conversation de l'onglet (survit au rechargement, pas à la fermeture).
  useEffect(() => {
    try {
      const brut = window.sessionStorage.getItem(CLE_CONV);
      if (brut) setMessages(JSON.parse(brut) as Message[]);
    } catch {
      // stockage indisponible ou contenu illisible : on repart d'une conversation vide
      setMessages([]);
    }
  }, []);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(CLE_CONV, JSON.stringify(messages.slice(-20)));
    } catch {
      // stockage plein / bloqué : la conversation reste en mémoire
    }
  }, [messages]);

  // Dernier état connu (onglet) : l'ouverture est instantanée, le réseau rafraîchit derrière.
  useEffect(() => {
    try {
      const brut = window.sessionStorage.getItem(`${CLE_ETAT}:${locale}`);
      if (brut) setEtat(JSON.parse(brut) as AssistantEtat);
    } catch {
      // stockage indisponible : on attend le réseau
    }
  }, [locale]);

  const chargerEtat = useCallback(async () => {
    setEtatErreur(false);
    try {
      const res = await fetch(`/api/assistant?langue=${locale}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as AssistantEtat;
      setEtat(data);
      try {
        window.sessionStorage.setItem(`${CLE_ETAT}:${locale}`, JSON.stringify(data));
      } catch {
        // stockage plein / bloqué : l'état reste en mémoire
      }
    } catch {
      setEtatErreur(true);
    }
  }, [locale]);

  // Repères chargés peu après l'arrivée (pastille du lanceur), puis à chaque ouverture.
  useEffect(() => {
    const t = window.setTimeout(() => void chargerEtat(), 600);
    return () => window.clearTimeout(t);
  }, [chargerEtat]);

  // Bulle de présentation, une seule fois — jamais par-dessus la visite guidée.
  useEffect(() => {
    let t: number | undefined;
    try {
      if (!window.localStorage.getItem(CLE_INTRO) && window.localStorage.getItem(CLE_TOUR)) {
        t = window.setTimeout(() => setBulle(true), 3500);
      }
    } catch {
      // sans stockage : pas de bulle (elle reviendrait à chaque page)
    }
    return () => window.clearTimeout(t);
  }, []);

  const fermerBulle = () => {
    setBulle(false);
    try {
      window.localStorage.setItem(CLE_INTRO, new Date().toISOString());
    } catch {
      // sans stockage : la bulle est fermée pour cette page
    }
  };

  const ouvrir = useCallback(() => {
    fermerBulle();
    setOuvert(true);
    setHeroClip("wave");
    preloadDari(["think", "type", "talk", "idle"]);
    void chargerEtat();
  }, [chargerEtat]);

  const envoyer = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || enCours) return;
      const historique: Message[] = [...messagesRef.current.filter((m) => !m.erreur), { role: "user", contenu: q }];
      setMessages(historique);
      setSaisie("");
      setEnCours(true);
      setPhase("think");
      const versType = window.setTimeout(() => setPhase("type"), 1400);
      try {
        const res = await fetch("/api/assistant/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historique.slice(-10).map((m) => ({ role: m.role, contenu: m.contenu.slice(0, 2000) })),
            page: pathname,
            langue: locale,
          }),
        });
        if (!res.ok) {
          const code = res.status === 501 ? labels.indisponible : res.status === 429 ? labels.trop : res.status === 503 ? labels.sature : labels.erreur;
          setMessages((m) => [...m, { role: "assistant", contenu: code, erreur: true }]);
        } else {
          const data = (await res.json()) as { reponse: string; ecrans: AssistantEcran[] };
          setMessages((m) => [...m, { role: "assistant", contenu: data.reponse, ecrans: data.ecrans }]);
          setHeroClip("talk");
          window.setTimeout(() => setHeroClip("idle"), 2600);
        }
      } catch {
        setMessages((m) => [...m, { role: "assistant", contenu: labels.erreur, erreur: true }]);
      } finally {
        window.clearTimeout(versType);
        setEnCours(false);
      }
    },
    [enCours, labels, locale, pathname]
  );

  // Ouverture depuis ailleurs dans l'app (visite guidée, boutons « Demander à Dari »).
  useEffect(() => {
    const surDemande = (e: Event) => {
      const question = (e as CustomEvent<{ question?: string }>).detail?.question;
      ouvrir();
      if (question) void envoyer(question);
    };
    window.addEventListener(ASK_DARI, surDemande);
    return () => window.removeEventListener(ASK_DARI, surDemande);
  }, [ouvrir, envoyer]);

  useEffect(() => {
    // Pas de défilement sur un fil vide : le bonjour et les repères restent en haut.
    if (!ouvert || (messages.length === 0 && !enCours)) return;
    finRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, enCours, ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    const t = window.setTimeout(() => champRef.current?.focus({ preventScroll: true }), 260);
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    window.addEventListener("keydown", surTouche);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", surTouche);
    };
  }, [ouvert]);

  const allerA = (e: AssistantEcran) => {
    router.push(`/${locale}${e.web}`);
    if (!window.matchMedia("(min-width: 1024px)").matches) setOuvert(false);
  };

  const attention = etat?.insights.filter((i) => i.niveau === "attention").length ?? 0;
  const nom = etat?.moi?.prenom ?? prenom;
  const conversation = messages.length > 0;

  return (
    <>
      {/* Lanceur */}
      {!ouvert ? (
        <div className="dari-launcher fixed end-4 z-[35] flex flex-col items-end gap-2 lg:bottom-6 lg:end-6">
          {bulle ? (
            <div className="dari-bubble relative max-w-[260px] rounded-[20px] bg-surface p-4 pe-9 text-[14px] leading-snug text-body shadow-pop" role="status">
              <p className="font-semibold text-ink">{labels.bulleTitre}</p>
              <p className="mt-1">{labels.bulleTexte}</p>
              <IconButton label={labels.fermer} tone="ghost" size="sm" className="absolute end-1.5 top-1.5" onClick={fermerBulle}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </IconButton>
            </div>
          ) : null}
          <Pressable
            data-tour="dari"
            aria-label={labels.ouvrir}
            title={labels.ouvrir}
            aria-haspopup="dialog"
            onClick={ouvrir}
            className="group relative flex size-[62px] items-end justify-center overflow-visible rounded-full bg-brand shadow-[0_14px_30px_-12px_rgb(18_18_18/0.55)] ring-4 ring-surface"
          >
            <span className="absolute inset-0 overflow-hidden rounded-full">
              <span className="absolute inset-x-0 bottom-[-6%] flex justify-center">
                <DariMotion clip="head" size={56} eager />
              </span>
            </span>
            {attention > 0 ? (
              <span className="absolute -end-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold leading-5 text-white ring-2 ring-surface">
                {attention}
              </span>
            ) : null}
          </Pressable>
        </div>
      ) : null}

      {/* Panneau */}
      {ouvert ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={labels.nom}
          className="dari-panel fixed inset-0 z-[70] flex flex-col overflow-hidden bg-ground lg:inset-auto lg:bottom-6 lg:end-6 lg:h-[min(680px,calc(100vh-48px))] lg:w-[410px] lg:rounded-[28px] lg:shadow-pop"
        >
          {/* En-tête : Dari en grand, sur le vert de la marque. */}
          <header className="relative shrink-0 overflow-hidden bg-brand px-5 pb-4 pt-[max(14px,env(safe-area-inset-top))] text-white">
            <div className="flex items-start gap-3">
              <DariMotion clip={enCours ? phase : heroClip} size={92} eager className="-mb-4 -ms-1 mt-1" />
              <div className="min-w-0 flex-1 pt-3">
                <p className="text-[20px] font-bold leading-tight tracking-[-0.01em]">{labels.nom}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-white/80">
                  <span className="size-2 rounded-full bg-lime" aria-hidden />
                  {enCours ? (phase === "think" ? labels.reflechit : labels.ecrit) : labels.sousTitre}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 pt-2">
                {conversation ? (
                  <IconButton label={labels.nouvelle} tone="none" className="text-white hover:bg-white/15" onClick={() => setMessages([])}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </IconButton>
                ) : null}
                <IconButton label={labels.fermer} tone="none" className="text-white hover:bg-white/15" onClick={() => setOuvert(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </IconButton>
              </div>
            </div>
          </header>

          {/* Fil */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-5" aria-live="polite">
            <div className="flex gap-2.5">
              <DariAvatar size={30} />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="rounded-[20px] rounded-ss-md bg-surface px-4 py-3 text-[14.5px] leading-relaxed text-body shadow-[0_1px_0_rgb(18_18_18/0.04)]">
                  <p className="font-semibold text-ink">{nom ? fill(labels.bonjour, { prenom: nom }) : labels.bonjour.replace(/ ?\{prenom\}/, "")}</p>
                  <p className="mt-0.5">{etat?.moi ? fill(labels.introMoi, { role: roleLabel, residence: etat.moi.residence ?? "", lots: etat.moi.lots.join(", ") }).replace(/\s*\(\s*\)/g, "").replace(/ {2,}/g, " ") : labels.intro}</p>
                </div>

                {/* Repères du moment */}
                {etatErreur && etat === null ? (
                  <div className="rounded-[18px] bg-warn-tint px-4 py-3 text-[14px] text-warn">
                    <p>{labels.etatErreur}</p>
                    <Pressable onClick={() => void chargerEtat()} className="mt-2 rounded-full bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-link">
                      {labels.reessayer}
                    </Pressable>
                  </div>
                ) : etat === null ? (
                  <div className="space-y-2" aria-label={labels.chargement}>
                    {[0, 1].map((i) => (
                      <div key={i} className="skeleton h-[58px] rounded-[18px]" />
                    ))}
                  </div>
                ) : etat && etat.insights.length > 0 ? (
                  <ul className="space-y-2">
                    {etat.insights.map((ins) => (
                      <li key={ins.cle}>
                        <Pressable
                          onClick={() => (ins.ecran ? allerA(ins.ecran) : undefined)}
                          disabled={!ins.ecran}
                          className="flex w-full items-start gap-3 rounded-[18px] bg-surface px-4 py-3 text-start text-[14px] leading-snug text-ink-strong hover:bg-hover"
                        >
                          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${TON[ins.niveau]}`} aria-hidden />
                          <span className="min-w-0 flex-1">{ins.texte}</span>
                          {ins.ecran ? (
                            <span className="mt-0.5 shrink-0 text-[12.5px] font-semibold text-link">
                              {labels.ouvrirEcran} <span className="inline-block rtl:-scale-x-100">→</span>
                            </span>
                          ) : null}
                        </Pressable>
                      </li>
                    ))}
                  </ul>
                ) : etat ? (
                  <p className="rounded-[18px] bg-surface px-4 py-3 text-[14px] text-soft">{labels.rienAFaire}</p>
                ) : null}

                {!conversation && etat && etat.suggestions.length > 0 ? (
                  <div>
                    <p className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-faint">{labels.suggestionsTitre}</p>
                    <div className="flex flex-wrap gap-2">
                      {etat.suggestions.map((s) => (
                        <Pressable
                          key={s}
                          onClick={() => void envoyer(s)}
                          disabled={enCours || !etat.disponible}
                          className="rounded-full border border-hairline-strong bg-surface px-3.5 py-2 text-start text-[13.5px] font-medium text-ink-strong hover:border-ink"
                        >
                          {s}
                        </Pressable>
                      ))}
                    </div>
                  </div>
                ) : null}

                {etat && !etat.disponible ? <p className="text-[13px] text-soft">{labels.indisponible}</p> : null}
              </div>
            </div>

            {/* Conversation */}
            <div className="mt-5 space-y-4">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-line rounded-[20px] rounded-ee-md bg-ink px-4 py-2.5 text-[14.5px] leading-relaxed text-white">{m.contenu}</p>
                  </div>
                ) : (
                  <div key={i} className="flex gap-2.5">
                    <DariAvatar size={30} />
                    <div className="min-w-0 max-w-[88%] space-y-2">
                      <div className={`rounded-[20px] rounded-ss-md px-4 py-3 text-[14.5px] leading-relaxed ${m.erreur ? "bg-warn-tint text-warn" : "bg-surface text-body"}`}>
                        <Texte texte={m.contenu} onEcran={allerA} />
                      </div>
                      {m.erreur && i === messages.length - 1 ? (
                        <Pressable
                          onClick={() => {
                            const derniere = [...messages].reverse().find((x) => x.role === "user");
                            setMessages((all) => all.filter((x) => !x.erreur && x !== derniere));
                            if (derniere) void envoyer(derniere.contenu);
                          }}
                          className="rounded-full bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-link"
                        >
                          {labels.reessayer}
                        </Pressable>
                      ) : null}
                      {m.ecrans && m.ecrans.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {m.ecrans.map((e) => (
                            <Pressable
                              key={e.cle}
                              onClick={() => allerA(e)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-cta px-3.5 py-2 text-[13.5px] font-semibold text-ink hover:bg-lime-hover"
                            >
                              {e.libelle}
                              <span className="inline-block rtl:-scale-x-100" aria-hidden>→</span>
                            </Pressable>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              )}
              {enCours ? (
                <div className="flex items-center gap-2.5">
                  <DariAvatar size={30} />
                  <span className="dari-dots flex gap-1 rounded-[20px] rounded-ss-md bg-surface px-4 py-3.5" aria-label={phase === "think" ? labels.reflechit : labels.ecrit}>
                    <span className="size-2 rounded-full bg-faint" />
                    <span className="size-2 rounded-full bg-faint" />
                    <span className="size-2 rounded-full bg-faint" />
                  </span>
                </div>
              ) : null}
              <div ref={finRef} />
            </div>
          </div>

          {/* Saisie */}
          <form
            className="shrink-0 border-t border-hairline bg-surface px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void envoyer(saisie);
            }}
          >
            <div className="flex items-end gap-2">
              <Textarea
                ref={champRef}
                value={saisie}
                onChange={(e) => setSaisie(e.target.value.slice(0, 2000))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void envoyer(saisie);
                  }
                }}
                rows={1}
                placeholder={labels.placeholder}
                aria-label={labels.placeholder}
                disabled={etat ? !etat.disponible : false}
                className="max-h-32 resize-none py-2.5 leading-snug"
                style={{ minHeight: 44, borderRadius: 22 }}
              />
              <IconButton type="submit"
                label={labels.envoyer}
                tone="none"
                disabled={!saisie.trim() || enCours}
                className="size-11 bg-brand text-white hover:bg-brand-deep"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </IconButton>
            </div>
            <p className="mt-1.5 px-2 text-center text-[11px] text-faint">{labels.avertissement}</p>
          </form>
        </div>
      ) : null}
    </>
  );
}
