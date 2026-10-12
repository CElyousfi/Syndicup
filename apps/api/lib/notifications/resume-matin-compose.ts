/** Composition pure du résumé du matin (lib/notifications/resume-matin.ts) — testable sans base. */
import type { WidgetSnapshot } from "../users/widget-compose";

const MAD = (s: string, langue: "FR" | "AR") => {
  const n = Number(s);
  const txt = Number.isFinite(n) ? n.toLocaleString(langue === "AR" ? "ar-MA" : "fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : s;
  return `${txt} MAD`;
};

const joursAvant = (iso: string, now: Date) => Math.round((new Date(iso).getTime() - now.getTime()) / 86_400_000);

/** Lignes du résumé, dans la langue du destinataire — null si rien à dire. Pure, testée. */
export function composerResume(s: WidgetSnapshot, langue: "FR" | "AR", now = new Date()): string | null {
  const fr = langue === "FR";
  const lignes: string[] = [];
  if (s.charges) {
    if (s.charges.solde_du !== "0.00" && s.charges.solde_du !== "0") {
      const j = s.charges.prochaine_echeance ? joursAvant(s.charges.prochaine_echeance, now) : null;
      const quand = j === null ? "" : j < 0 ? (fr ? ` — en retard de ${-j} j` : ` — متأخر بـ ${-j} يوم`) : j === 0 ? (fr ? " — échéance aujourd'hui" : " — الاستحقاق اليوم") : fr ? ` — échéance dans ${j} j` : ` — الاستحقاق خلال ${j} يوم`;
      lignes.push(fr ? `Charges dues : ${MAD(s.charges.solde_du, langue)}${quand}.` : `الرسوم المستحقة: ${MAD(s.charges.solde_du, langue)}${quand}.`);
    }
  }
  if (s.ag) {
    const j = joursAvant(s.ag.date_ag, now);
    if (s.ag.statut === "EN_COURS") lignes.push(fr ? "Assemblée en cours : votez depuis l'app." : "الجمع العام جارٍ: صوّتوا من التطبيق.");
    else if (j >= 0 && j <= 7) lignes.push(fr ? (j === 0 ? "Assemblée générale aujourd'hui." : j === 1 ? "Assemblée générale demain." : `Assemblée générale dans ${j} jours.`) : j === 0 ? "الجمع العام اليوم." : j === 1 ? "الجمع العام غدًا." : `الجمع العام خلال ${j} أيام.`);
  }
  if (s.residence) {
    const r = s.residence;
    if (r.incidents_ouverts > 0) lignes.push(fr ? `${r.incidents_ouverts} incident(s) ouvert(s)${r.incidents_sla_depasse ? `, ${r.incidents_sla_depasse} hors délai` : ""}.` : `${r.incidents_ouverts} حادث مفتوح${r.incidents_sla_depasse ? `، ${r.incidents_sla_depasse} خارج الأجل` : ""}.`);
    if (r.reservations_a_valider > 0) lignes.push(fr ? `${r.reservations_a_valider} réservation(s) à valider.` : `${r.reservations_a_valider} حجز للمصادقة.`);
    if (r.impaye_total !== "0.00") lignes.push(fr ? `Impayés : ${MAD(r.impaye_total, langue)} (recouvrement ${Math.round(r.taux_recouvrement * 100)} %).` : `المتأخرات: ${MAD(r.impaye_total, langue)} (التحصيل ${Math.round(r.taux_recouvrement * 100)} ٪).`);
  }
  if (s.gardien) {
    const g = s.gardien;
    if (g.visites_en_attente > 0) lignes.push(fr ? `${g.visites_en_attente} visiteur(s) en attente.` : `${g.visites_en_attente} زائر في الانتظار.`);
    if (g.arrivees_lcd_aujourdhui > 0 || g.departs_lcd_aujourdhui > 0) lignes.push(fr ? `Aujourd'hui : ${g.arrivees_lcd_aujourdhui} arrivée(s), ${g.departs_lcd_aujourdhui} départ(s).` : `اليوم: ${g.arrivees_lcd_aujourdhui} وصول، ${g.departs_lcd_aujourdhui} مغادرة.`);
  }
  if (s.affichage && s.affichage.non_lues > 0) lignes.push(fr ? `${s.affichage.non_lues} annonce(s) non lue(s).` : `${s.affichage.non_lues} إعلان غير مقروء.`);
  return lignes.length ? lignes.join(" ") : null;
}

