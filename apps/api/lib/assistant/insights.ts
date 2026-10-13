/**
 * Dari — ce qui mérite l'attention MAINTENANT, calculé sans modèle de langage à partir de
 * l'instantané du widget (mêmes données, même filtrage par rôle, RLS en seconde couche).
 *
 * Fonctions pures et déterministes : Dari reste utile même quand le modèle est indisponible,
 * et ces lignes sont testables. Montants : chaînes décimales de l'API, jamais de float.
 */
import type { Role } from "../auth/permissions";
import type { WidgetSnapshot } from "../users/widget-compose";
import { lienEcran, type EcranLien, type Langue } from "./ecrans";
import { money } from "../money";

export type NiveauInsight = "attention" | "info" | "succes";

export interface Insight {
  cle: string;
  niveau: NiveauInsight;
  texte: string;
  ecran: EcranLien | null;
}

/** « 12500.5 » → « 12 500,50 MAD » — sur la chaîne décimale, sans passer par un float. */
export function formatMontant(valeur: string, langue: Langue): string {
  const [entier = "0", dec = ""] = money(valeur).toFixed(2).split(".");
  const negatif = entier.startsWith("-");
  const chiffres = negatif ? entier.slice(1) : entier;
  const groupes = chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const nombre = `${negatif ? "-" : ""}${groupes},${dec}`;
  return langue === "ar" ? `${nombre} درهم` : `${nombre} MAD`;
}

/** « 2026-11-15 » ou ISO complet → « 15/11/2026 » (chiffres latins, usage marocain). */
export function formatDate(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
}

function joursEntre(iso: string, maintenant: Date): number {
  const cible = Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const auj = Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate());
  return Math.round((cible - auj) / 86_400_000);
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

const T = {
  fr: {
    soldeRetard: (m: string, d: string) => `Vous avez ${m} de charges en retard (échéance dépassée depuis le ${d}).`,
    soldeEcheance: (m: string, d: string, j: number) =>
      j === 0 ? `${m} à régler aujourd'hui.` : `Prochaine échéance : ${m} à régler avant le ${d} (dans ${j} jour${j > 1 ? "s" : ""}).`,
    soldeDu: (m: string) => `Il vous reste ${m} à régler.`,
    aJour: "Vos charges sont à jour. Merci !",
    agDirect: (v: number, n: number) => `L'assemblée générale est en cours : ${v} résolution${v > 1 ? "s" : ""} votée${v > 1 ? "s" : ""} sur ${n}.`,
    agProchaine: (d: string, n: number) => `Prochaine assemblée générale le ${d} (${n} résolution${n > 1 ? "s" : ""} à l'ordre du jour).`,
    sla: (n: number) => `${n} incident${n > 1 ? "s ont" : " a"} dépassé son délai de traitement.`,
    incidents: (n: number) => `${n} incident${n > 1 ? "s" : ""} en cours de traitement.`,
    recouvrement: (t: string, m: string) => `Recouvrement à ${t} : ${m} d'impayés sur les appels émis.`,
    recouvrementBon: (t: string) => `Recouvrement à ${t} sur les appels émis — très bon niveau.`,
    reservations: (n: number) => `${n} réservation${n > 1 ? "s" : ""} d'espace commun à valider.`,
    urgent: (titre: string) => `Annonce urgente non lue : « ${titre} ».`,
    nonLues: (n: number) => `${n} annonce${n > 1 ? "s" : ""} non lue${n > 1 ? "s" : ""} sur le tableau d'affichage.`,
    visites: (n: number) => `${n} visiteur${n > 1 ? "s" : ""} en attente de réponse d'un résident.`,
    lcd: (a: number, d: number) => `Location courte durée aujourd'hui : ${a} arrivée${a > 1 ? "s" : ""}, ${d} départ${d > 1 ? "s" : ""}.`,
  },
  ar: {
    soldeRetard: (m: string, d: string) => `لديكم ${m} من الرسوم المتأخرة (انقضى أجل الأداء منذ ${d}).`,
    soldeEcheance: (m: string, d: string, j: number) =>
      j === 0 ? `${m} واجبة الأداء اليوم.` : `الأجل القادم: ${m} قبل ${d} (بعد ${j} يوم).`,
    soldeDu: (m: string) => `يتبقى عليكم أداء ${m}.`,
    aJour: "رسومكم مؤداة بالكامل. شكرًا!",
    agDirect: (v: number, n: number) => `الجمع العام جارٍ الآن: تم التصويت على ${v} من أصل ${n} قرارات.`,
    agProchaine: (d: string, n: number) => `الجمع العام القادم يوم ${d} (${n} قرارات في جدول الأعمال).`,
    sla: (n: number) => `${n} حادث تجاوز أجل المعالجة.`,
    incidents: (n: number) => `${n} حادث قيد المعالجة.`,
    recouvrement: (t: string, m: string) => `نسبة التحصيل ${t}: ${m} غير مؤداة على النداءات الصادرة.`,
    recouvrementBon: (t: string) => `نسبة التحصيل ${t} على النداءات الصادرة — مستوى جيد جدًا.`,
    reservations: (n: number) => `${n} حجز للفضاءات المشتركة في انتظار المصادقة.`,
    urgent: (titre: string) => `إعلان عاجل غير مقروء: «${titre}».`,
    nonLues: (n: number) => `${n} إعلان غير مقروء في لوحة الإعلانات.`,
    visites: (n: number) => `${n} زائر في انتظار رد أحد السكان.`,
    lcd: (a: number, d: number) => `الكراء القصير اليوم: ${a} وصول، ${d} مغادرة.`,
  },
} as const;

/** Ordonne : attention d'abord, puis info, puis succès ; au plus `max` lignes. */
export function construireInsights(s: WidgetSnapshot, langue: Langue, maintenant = new Date(), max = 4): Insight[] {
  const t = T[langue];
  const role = s.role as Role;
  const lien = (cle: string) => lienEcran(cle, role, langue);
  const out: Insight[] = [];

  if (s.charges) {
    const c = s.charges;
    const solde = money(c.solde_du);
    if (solde.greaterThan(0)) {
      const montant = formatMontant(c.prochain_montant ?? c.solde_du, langue);
      if (c.prochaine_echeance) {
        const j = joursEntre(c.prochaine_echeance, maintenant);
        out.push(
          j < 0
            ? { cle: "charges_retard", niveau: "attention", texte: t.soldeRetard(formatMontant(c.solde_du, langue), formatDate(c.prochaine_echeance)), ecran: lien("payer") }
            : { cle: "charges_echeance", niveau: j <= 7 ? "attention" : "info", texte: t.soldeEcheance(montant, formatDate(c.prochaine_echeance), j), ecran: lien("payer") }
        );
      } else {
        out.push({ cle: "charges_du", niveau: "info", texte: t.soldeDu(formatMontant(c.solde_du, langue)), ecran: lien("payer") });
      }
    } else {
      out.push({ cle: "charges_a_jour", niveau: "succes", texte: t.aJour, ecran: lien("releve") });
    }
  }

  if (s.ag) {
    out.push(
      s.ag.statut === "EN_COURS"
        ? { cle: "ag_en_cours", niveau: "attention", texte: t.agDirect(s.ag.nb_votees, s.ag.nb_resolutions), ecran: lien("ag") }
        : { cle: "ag_prochaine", niveau: "info", texte: t.agProchaine(formatDate(s.ag.date_ag), s.ag.nb_resolutions), ecran: lien("ag") }
    );
  }

  if (s.residence) {
    const r = s.residence;
    if (r.incidents_sla_depasse > 0) out.push({ cle: "incidents_sla", niveau: "attention", texte: t.sla(r.incidents_sla_depasse), ecran: lien("incidents") });
    else if (r.incidents_ouverts > 0) out.push({ cle: "incidents_ouverts", niveau: "info", texte: t.incidents(r.incidents_ouverts), ecran: lien("incidents") });
    if (money(r.impaye_total).greaterThan(0)) {
      out.push({
        cle: "recouvrement",
        niveau: r.taux_recouvrement < 0.85 ? "attention" : "info",
        texte: t.recouvrement(pct(r.taux_recouvrement), formatMontant(r.impaye_total, langue)),
        ecran: lien("appels_de_fonds"),
      });
    } else if (r.taux_recouvrement >= 0.95) {
      out.push({ cle: "recouvrement", niveau: "succes", texte: t.recouvrementBon(pct(r.taux_recouvrement)), ecran: lien("appels_de_fonds") });
    }
    if (r.reservations_a_valider > 0) out.push({ cle: "reservations", niveau: "info", texte: t.reservations(r.reservations_a_valider), ecran: lien("reservations") });
  }

  if (s.affichage && s.affichage.non_lues > 0) {
    const urgente = s.affichage.annonces.find((a) => a.urgent && !a.lu);
    out.push(
      urgente
        ? { cle: "annonce_urgente", niveau: "attention", texte: t.urgent(urgente.titre), ecran: lien("affichage") }
        : { cle: "annonces", niveau: "info", texte: t.nonLues(s.affichage.non_lues), ecran: lien("affichage") }
    );
  }

  if (s.gardien) {
    const g = s.gardien;
    if (g.visites_en_attente > 0) out.push({ cle: "visites", niveau: "attention", texte: t.visites(g.visites_en_attente), ecran: lien("visites") });
    if (g.arrivees_lcd_aujourdhui + g.departs_lcd_aujourdhui > 0) {
      out.push({ cle: "lcd", niveau: "info", texte: t.lcd(g.arrivees_lcd_aujourdhui, g.departs_lcd_aujourdhui), ecran: lien("lcd") });
    }
    if (g.incidents_ouverts > 0) out.push({ cle: "incidents_ouverts", niveau: "info", texte: t.incidents(g.incidents_ouverts), ecran: lien("incidents") });
  }

  const rang: Record<NiveauInsight, number> = { attention: 0, info: 1, succes: 2 };
  return out
    .map((x, i) => ({ x, i }))
    .sort((a, b) => rang[a.x.niveau] - rang[b.x.niveau] || a.i - b.i)
    .slice(0, max)
    .map(({ x }) => x);
}

/** Questions proposées (puces) — par famille de rôle, dans la langue de l'utilisateur. */
const SUGGESTIONS: Record<Langue, Record<"resident" | "locataire" | "gestion" | "gardien" | "prestataire" | "lcd" | "admin", string[]>> = {
  fr: {
    resident: ["Combien je dois et avant quand ?", "Comment payer mes charges ?", "Comment signaler une fuite ?", "Quand a lieu la prochaine AG ?"],
    locataire: ["Comment signaler un problème ?", "Comment réserver la salle commune ?", "Où trouver les annonces de la résidence ?", "Comment autoriser un visiteur ?"],
    gestion: ["Résume-moi la situation de la résidence", "Qui n'a pas encore payé ?", "Comment générer un appel de fonds ?", "Comment préparer l'AG ?"],
    gardien: ["Qu'est-ce que j'ai à faire aujourd'hui ?", "Comment enregistrer un visiteur ?", "Comment encaisser des espèces ?", "Comment signaler un incident ?"],
    prestataire: ["Quels sont mes tickets ouverts ?", "Comment clôturer une intervention ?", "Comment ajouter une photo à un incident ?"],
    lcd: ["Comment déclarer un séjour ?", "Quelles sont les règles de location courte durée ?", "Comment signaler un problème pendant un séjour ?"],
    admin: ["Comment créer une copropriété ?", "Comment inviter le premier syndic ?"],
  },
  ar: {
    resident: ["كم عليّ أن أؤدي وقبل متى؟", "كيف أؤدي رسومي؟", "كيف أبلغ عن تسرب مائي؟", "متى الجمع العام القادم؟"],
    locataire: ["كيف أبلغ عن مشكلة؟", "كيف أحجز القاعة المشتركة؟", "أين أجد إعلانات الإقامة؟", "كيف أسمح بدخول زائر؟"],
    gestion: ["لخّص لي وضعية الإقامة", "من لم يؤدِّ بعد؟", "كيف أصدر نداء أموال؟", "كيف أحضّر الجمع العام؟"],
    gardien: ["ما المطلوب مني اليوم؟", "كيف أسجل زائرًا؟", "كيف أستلم مبلغًا نقديًا؟", "كيف أبلغ عن حادث؟"],
    prestataire: ["ما هي تذاكري المفتوحة؟", "كيف أغلق تدخلًا؟", "كيف أضيف صورة إلى حادث؟"],
    lcd: ["كيف أصرّح بإقامة؟", "ما قواعد الكراء القصير المدة؟", "كيف أبلغ عن مشكلة أثناء إقامة؟"],
    admin: ["كيف أنشئ ملكية مشتركة؟", "كيف أدعو أول سنديك؟"],
  },
};

export function suggestionsPour(role: Role, langue: Langue): string[] {
  const famille =
    role === "SUPER_ADMIN"
      ? "admin"
      : role === "SYNDIC" || role === "CONSEIL_SYNDICAL" || role === "SYNDIC_COMPTABLE"
        ? "gestion"
        : role === "GARDIEN"
          ? "gardien"
          : role === "PRESTATAIRE"
            ? "prestataire"
            : role === "GESTIONNAIRE_LCD"
              ? "lcd"
              : role === "LOCATAIRE"
                ? "locataire"
                : "resident";
  return SUGGESTIONS[langue][famille];
}
