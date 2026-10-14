/**
 * Dari — ce qui mérite l'attention MAINTENANT, calculé sans modèle de langage à partir de
 * l'instantané du widget (mêmes données, même filtrage par rôle, RLS en seconde couche).
 *
 * Fonctions pures et déterministes : Dari reste utile même quand le modèle est indisponible,
 * et ces lignes sont testables. Montants : chaînes décimales de l'API, jamais de float.
 */
import type { Role } from "../auth/permissions";
import type { WidgetSnapshot } from "../users/widget-compose";
import type { Dossier } from "./dossier";
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

/** « 15/11/2026 » → « 2026-11-15 » (les dates du dossier sont lisibles, celles du widget ISO). */
function isoDepuisLisible(d: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(d);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d;
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
    justifAttente: (m: string) => `Votre justificatif de ${m} est en attente de validation par le syndic.`,
    justifRejete: (m: string) => `Votre justificatif de ${m} a été refusé — à redéposer avec une preuve lisible.`,
    monIncidentRetard: (c: string) => `Votre signalement « ${c} » a dépassé son délai de traitement.`,
    monIncident: (n: number) => `${n} de vos signalements ${n > 1 ? "sont" : "est"} en cours de traitement.`,
    visiteAttente: (lot: string) => `Un visiteur attend votre réponse pour le lot ${lot}.`,
    reservation: (e: string, d: string) => `Réservation « ${e} » le ${d}.`,
    reservationAttente: (e: string) => `Votre réservation « ${e} » attend la validation du syndic.`,
    justifsAValider: (n: number) => `${n} justificatif${n > 1 ? "s" : ""} de paiement à valider.`,
    depensesAApprouver: (n: number) => `${n} dépense${n > 1 ? "s" : ""} en attente d'approbation.`,
    contratFin: (l: string, d: string) => `Le contrat « ${l} » arrive à échéance le ${d}.`,
    contratsBrouillon: (n: number) => `${n} contrat${n > 1 ? "s" : ""} encore en brouillon — à activer pour générer les échéances.`,
    tachesRetard: (n: number) => `${n} tâche${n > 1 ? "s" : ""} en retard.`,
    contestations: (n: number) => `${n} contestation${n > 1 ? "s" : ""} de charges à traiter.`,
    budgetPropose: (ex: string) => `Le budget ${ex} est proposé : à faire voter en assemblée générale.`,
    mesTaches: (n: number) => `${n} tâche${n > 1 ? "s" : ""} à faire aujourd'hui.`,
    sejourAujourdhui: (lot: string) => `Arrivée de voyageurs aujourd'hui au lot ${lot}.`,
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
    justifAttente: (m: string) => `وثيقة إثبات أدائكم بمبلغ ${m} في انتظار مصادقة السنديك.`,
    justifRejete: (m: string) => `رُفضت وثيقة إثبات أدائكم بمبلغ ${m} — يرجى إعادة إيداعها بإثبات واضح.`,
    monIncidentRetard: (c: string) => `تجاوز تبليغكم «${c}» أجل المعالجة.`,
    monIncident: (n: number) => `${n} من تبليغاتكم قيد المعالجة.`,
    visiteAttente: (lot: string) => `زائر ينتظر ردكم للوحدة ${lot}.`,
    reservation: (e: string, d: string) => `حجز «${e}» يوم ${d}.`,
    reservationAttente: (e: string) => `حجزكم «${e}» في انتظار مصادقة السنديك.`,
    justifsAValider: (n: number) => `${n} وثيقة إثبات أداء في انتظار المصادقة.`,
    depensesAApprouver: (n: number) => `${n} مصروف في انتظار الموافقة.`,
    contratFin: (l: string, d: string) => `ينتهي العقد «${l}» بتاريخ ${d}.`,
    contratsBrouillon: (n: number) => `${n} عقد ما زال مسودة — فعّلوه لإنشاء الاستحقاقات.`,
    tachesRetard: (n: number) => `${n} مهمة متأخرة.`,
    contestations: (n: number) => `${n} اعتراض على الرسوم في انتظار المعالجة.`,
    budgetPropose: (ex: string) => `ميزانية ${ex} مقترحة: يجب التصويت عليها في الجمع العام.`,
    mesTaches: (n: number) => `${n} مهمة لإنجازها اليوم.`,
    sejourAujourdhui: (lot: string) => `وصول مسافرين اليوم إلى الوحدة ${lot}.`,
  },
} as const;

/** Ordonne : attention d'abord, puis info, puis succès ; au plus `max` lignes. */
export function construireInsights(s: WidgetSnapshot & Partial<Dossier>, langue: Langue, maintenant = new Date(), max = 5): Insight[] {
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

  const justif = s.mes_justificatifs?.[0];
  if (justif?.statut === "en attente") out.push({ cle: "justif_attente", niveau: "info", texte: t.justifAttente(formatMontant(justif.montant, langue)), ecran: lien("payer") });
  else if (justif?.statut === "refusé") out.push({ cle: "justif_rejete", niveau: "attention", texte: t.justifRejete(formatMontant(justif.montant, langue)), ecran: lien("payer") });

  // Mes signalements (résident / prestataire) — les rôles de gestion ont le bloc résidence.
  if (s.incidents && !s.residence && role !== "GARDIEN") {
    const miens = s.incidents.filter((i) => i.statut === "ouvert" || i.statut === "en cours");
    const retard = miens.find((i) => i.en_retard);
    if (retard) out.push({ cle: "mon_incident_retard", niveau: "attention", texte: t.monIncidentRetard(retard.categorie), ecran: lien("incidents") });
    else if (miens.length) out.push({ cle: "mes_incidents", niveau: "info", texte: t.monIncident(miens.length), ecran: lien("incidents") });
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
    const g = s.gestion;
    if (g) {
      if (g.justificatifs_a_valider > 0) out.push({ cle: "justifs_a_valider", niveau: "attention", texte: t.justifsAValider(g.justificatifs_a_valider), ecran: lien("justificatifs") });
      if (g.depenses_a_approuver.length) out.push({ cle: "depenses_a_approuver", niveau: "info", texte: t.depensesAApprouver(g.depenses_a_approuver.length), ecran: lien("depenses") });
      if (g.contestations_ouvertes > 0) out.push({ cle: "contestations", niveau: "info", texte: t.contestations(g.contestations_ouvertes), ecran: lien("contestations") });
      if (g.taches_en_retard.length) out.push({ cle: "taches_retard", niveau: "attention", texte: t.tachesRetard(g.taches_en_retard.length), ecran: lien("taches") });
      const finProche = g.contrats_echeance.find((c) => c.statut === "actif" && c.date_fin && joursEntre(isoDepuisLisible(c.date_fin), maintenant) <= 60);
      if (finProche) out.push({ cle: "contrat_fin", niveau: "info", texte: t.contratFin(finProche.libelle, finProche.date_fin!), ecran: lien("contrats") });
      const brouillons = g.contrats_echeance.filter((c) => c.statut === "brouillon").length;
      if (brouillons) out.push({ cle: "contrats_brouillon", niveau: "info", texte: t.contratsBrouillon(brouillons), ecran: lien("contrats") });
      if (g.budget?.statut.startsWith("proposé")) out.push({ cle: "budget_propose", niveau: "info", texte: t.budgetPropose(g.budget.exercice), ecran: lien("budgets") });
    }
  }

  // Résident : visiteurs en attente de ma réponse, réservations.
  if (!s.gardien && s.visites?.some((v) => v.statut === "en attente")) {
    const v = s.visites.find((x) => x.statut === "en attente")!;
    out.push({ cle: "visite_attente", niveau: "attention", texte: t.visiteAttente(v.lot), ecran: lien("visites") });
  }
  const resa = s.mes_reservations?.[0];
  if (resa) {
    out.push(
      resa.statut === "en attente"
        ? { cle: "resa_attente", niveau: "info", texte: t.reservationAttente(resa.espace), ecran: lien("reservations") }
        : { cle: "resa", niveau: "info", texte: t.reservation(resa.espace, resa.debut.slice(0, 10)), ecran: lien("reservations") }
    );
  }
  if (!s.gardien && s.sejours_lcd?.length) {
    const auj = s.sejours_lcd.find((x) => x.arrivee === formatDate(s.genere_le));
    if (auj) out.push({ cle: "sejour_auj", niveau: "info", texte: t.sejourAujourdhui(auj.lot), ecran: lien("lcd") });
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
    if (s.mes_taches?.length) out.push({ cle: "mes_taches", niveau: "info", texte: t.mesTaches(s.mes_taches.length), ecran: lien("taches") });
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

export function suggestionsPour(role: Role, langue: Langue, d?: Partial<Dossier>): string[] {
  const base = suggestionsBase(role, langue);
  if (!d) return base;
  const ar = langue === "ar";
  const extra: string[] = [];
  if (d.charges && money(d.charges.solde_du).greaterThan(0)) extra.push(ar ? "لماذا عليّ هذا المبلغ؟" : "Pourquoi je dois ce montant ?");
  if (d.ag) extra.push(ar ? "ما هي نقاط جدول أعمال الجمع العام؟" : "Que contient l'ordre du jour de l'AG ?");
  if (d.incidents?.some((i) => i.statut !== "RESOLU" && i.statut !== "FERME")) extra.push(ar ? "أين وصل تبليغي؟" : "Où en est mon signalement ?");
  if (d.gestion?.lots_impayes.length) extra.push(ar ? "من هم الأكثر تأخرًا في الأداء؟" : "Quels lots sont le plus en retard ?");
  if (d.gestion?.contrats_echeance.some((c) => c.statut === "BROUILLON")) extra.push(ar ? "كيف أفعّل العقود؟" : "Comment activer les contrats en brouillon ?");
  if (d.annonces_detail?.some((a) => !a.lu)) extra.push(ar ? "ما الجديد في لوحة الإعلانات؟" : "Quoi de neuf sur le tableau d'affichage ?");
  return [...extra, ...base].slice(0, 5);
}

function suggestionsBase(role: Role, langue: Langue): string[] {
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
