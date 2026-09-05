/**
 * Socle commun des PDF M18 (rapport de gestion, relevé de charges) : polices (Noto Sans Arabic
 * pour l'arabe — bidi géré par react-pdf ≥ 4 via `direction: "rtl"`), dictionnaire FR / AR des
 * libellés, formatage des montants (chaînes décimales → « 1 234,56 MAD », jamais un float) et
 * petits composants (ligne clé/valeur, tableau) qui respectent le sens de lecture.
 */
import React from "react";
import path from "node:path";
import fs from "node:fs";
import { Font, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { LanguePdf } from "./schemas";

function dossierPolices(): string {
  const candidats = [path.join(process.cwd(), "lib", "pdf", "fonts"), path.join(process.cwd(), "apps", "api", "lib", "pdf", "fonts")];
  return candidats.find((c) => fs.existsSync(path.join(c, "NotoSansArabic-Regular.ttf"))) ?? candidats[0]!;
}

let policesEnregistrees = false;
export function enregistrerPolices() {
  if (policesEnregistrees) return;
  const dossier = dossierPolices();
  Font.register({
    family: "NotoSansArabic",
    fonts: [
      { src: path.join(dossier, "NotoSansArabic-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dossier, "NotoSansArabic-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Pas de césure automatique (les mots arabes ne se coupent pas).
  Font.registerHyphenationCallback((mot) => [mot]);
  policesEnregistrees = true;
}

export function familles(langue: LanguePdf) {
  return langue === "ar" ? { normal: "NotoSansArabic", gras: "NotoSansArabic" } : { normal: "Helvetica", gras: "Helvetica-Bold" };
}

export function formatMad(v: string | null | undefined, langue: LanguePdf = "fr"): string {
  if (v === null || v === undefined || v === "") return "—";
  const negatif = v.startsWith("-");
  const [entier = "0", dec = ""] = v.replace(/^-/, "").split(".");
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const s = `${negatif ? "-" : ""}${groupe},${(dec + "00").slice(0, 2)}`;
  return langue === "ar" ? `${s} د.م.` : `${s} MAD`;
}

export function formatPourcent(v: string | null | undefined): string {
  return v === null || v === undefined ? "—" : `${v.replace(".", ",")} %`;
}

export function formatDate(iso: string | null | undefined, langue: LanguePdf = "fr"): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString(langue === "ar" ? "ar-MA" : "fr-FR", { timeZone: "UTC" });
}

// ── Dictionnaire ───────────────────────────────────────────────────────────────────────────────

export const DICO = {
  fr: {
    rapportGestion: "Rapport de gestion",
    exercice: "Exercice",
    genereLe: "Généré le",
    par: "par",
    varianteComplete: "Version complète (syndic / conseil syndical) — état des impayés nominatif par lot",
    variantePublique: "Version destinée à l'assemblée générale — sans détail par lot",
    synthese: "1. Synthèse de l'exercice",
    ouverture: "Solde d'ouverture (compte courant estimé)",
    entrees: "Encaissements (paiements validés)",
    sortiesCourant: "Décaissements compte courant",
    cloture: "Solde de clôture (compte courant estimé)",
    reserveOuverture: "Fonds de réserve — ouverture",
    reserveCloture: "Fonds de réserve — clôture",
    reserveNonConfiguree: "Fonds de réserve non constitué",
    recouvrement: "Taux de recouvrement",
    appele: "Appelé",
    encaisse: "Encaissé",
    impayesTotal: "Impayés échus",
    lotsEnRetard: "lot(s) en retard",
    justificatifsAttente: "Paiements déclarés en attente de validation",
    avertissementEstimation: "Le compte courant est une estimation calculée à partir des paiements validés et des dépenses payées ; le solde bancaire réel se lit sur le relevé (aucune connexion bancaire).",
    seuilNonConfigure: "Le seuil d'approbation des dépenses par le conseil syndical n'est pas configuré : toutes les dépenses ont été approuvées par le syndic.",
    budget: "2. Budget voté et réalisé",
    aucunBudget: "Aucun budget ACTIF pour cet exercice.",
    poste: "Poste",
    prevu: "Prévu",
    realise: "Réalisé",
    ecart: "Écart",
    taux: "%",
    total: "Total",
    horsPoste: "Hors poste",
    depenses: "3. Dépenses de l'exercice",
    parCategorie: "Répartition par catégorie",
    categorie: "Catégorie",
    montant: "Montant",
    part: "Part",
    nb: "Nb",
    listeDepenses: "Détail des dépenses payées",
    date: "Date",
    libelle: "Libellé",
    prestataire: "Prestataire",
    source: "Source",
    suite: "… et {{n}} autre(s) dépense(s) — détail complet dans le grand livre.",
    impayes: "4. État des impayés",
    anciennete: "Par ancienneté",
    tranche: "Tranche",
    lignes: "Lignes",
    lots: "Lots",
    parLot: "Par lot (version complète)",
    lot: "Lot",
    resteDu: "Reste dû",
    retardMax: "Retard max (jours)",
    conteste: "Contesté",
    oui: "oui",
    non: "non",
    tranches: { "0_30": "0 – 30 jours", "31_90": "31 – 90 jours", "91_180": "91 – 180 jours", PLUS_180: "> 180 jours" } as Record<string, string>,
    reserve: "5. Fonds de réserve",
    mouvement: "Mouvement",
    aucunMouvement: "Aucun mouvement sur l'exercice.",
    faits: "6. Faits marquants",
    incidents: "Incidents signalés",
    incidentsMajeurs: "Incidents d'urgence maximale",
    agTenues: "Assemblées générales tenues",
    contratsSignes: "Contrats signés",
    aucun: "Aucun",
    resolutions: "résolution(s)",
    quorum: "quorum",
    signatures: "7. Approbation",
    signatureSyndic: "Le syndic",
    signaturePresident: "Le président du conseil syndical",
    mentionApprobation: "Rapport soumis à l'approbation de l'assemblée générale (Loi 18-00, reddition des comptes).",
    pied: "SyndicUp — rapport généré à partir des écritures immuables (paiements, dépenses, fonds de réserve). Montants en dirhams TTC.",
    // Relevé
    releve: "Relevé de charges",
    etatDate: "État daté du lot",
    proprietaires: "Propriétaire(s)",
    periode: "Période",
    type: "Type",
    du: "Dû",
    paye: "Payé",
    statut: "Statut",
    echeance: "Échéance",
    appels: "Appels de fonds de l'exercice",
    paiements: "Paiements de l'exercice",
    methode: "Méthode",
    reference: "Référence",
    soldeExercice: "Solde de l'exercice",
    soldeGlobal: "Solde total dû (tous exercices)",
    enAttente: "Déclarations de paiement en attente de validation",
    aucuneLigne: "Aucune ligne.",
    mentionReleve: "Document établi à la date d'émission à partir des écritures de la copropriété ; il ne vaut pas quittance des sommes restant dues.",
  },
  ar: {
    rapportGestion: "تقرير التسيير",
    exercice: "السنة المالية",
    genereLe: "أُنشئ بتاريخ",
    par: "من طرف",
    varianteComplete: "النسخة الكاملة (السنديك / المجلس النقابي) — وضعية المتأخرات حسب كل وحدة",
    variantePublique: "نسخة موجهة إلى الجمعية العامة — بدون تفاصيل حسب الوحدات",
    synthese: "1. ملخص السنة المالية",
    ouverture: "رصيد الافتتاح (الحساب الجاري التقديري)",
    entrees: "المداخيل (الدفعات المصادق عليها)",
    sortiesCourant: "المصاريف من الحساب الجاري",
    cloture: "رصيد الإقفال (الحساب الجاري التقديري)",
    reserveOuverture: "صندوق الاحتياط — الافتتاح",
    reserveCloture: "صندوق الاحتياط — الإقفال",
    reserveNonConfiguree: "صندوق الاحتياط غير مُنشأ",
    recouvrement: "نسبة التحصيل",
    appele: "المطلوب",
    encaisse: "المحصَّل",
    impayesTotal: "المتأخرات المستحقة",
    lotsEnRetard: "وحدة (وحدات) متأخرة",
    justificatifsAttente: "دفعات مصرَّح بها في انتظار التحقق",
    avertissementEstimation: "الحساب الجاري تقدير محسوب من الدفعات المصادق عليها والمصاريف المدفوعة؛ الرصيد البنكي الفعلي يُقرأ من الكشف البنكي (لا يوجد ربط بنكي).",
    seuilNonConfigure: "عتبة موافقة المجلس النقابي على المصاريف غير مُحددة: جميع المصاريف تمت الموافقة عليها من طرف السنديك.",
    budget: "2. الميزانية المصوَّت عليها والمُنجَز",
    aucunBudget: "لا توجد ميزانية نشطة لهذه السنة المالية.",
    poste: "البند",
    prevu: "المتوقع",
    realise: "المُنجَز",
    ecart: "الفارق",
    taux: "%",
    total: "المجموع",
    horsPoste: "خارج البنود",
    depenses: "3. مصاريف السنة المالية",
    parCategorie: "التوزيع حسب الفئة",
    categorie: "الفئة",
    montant: "المبلغ",
    part: "الحصة",
    nb: "العدد",
    listeDepenses: "تفاصيل المصاريف المدفوعة",
    date: "التاريخ",
    libelle: "البيان",
    prestataire: "المزوِّد",
    source: "المصدر",
    suite: "… و{{n}} مصروف(ات) أخرى — التفاصيل الكاملة في دفتر الأستاذ.",
    impayes: "4. وضعية المتأخرات",
    anciennete: "حسب الأقدمية",
    tranche: "الفئة الزمنية",
    lignes: "السطور",
    lots: "الوحدات",
    parLot: "حسب الوحدة (النسخة الكاملة)",
    lot: "الوحدة",
    resteDu: "المتبقي",
    retardMax: "أقصى تأخير (أيام)",
    conteste: "مُعترَض عليه",
    oui: "نعم",
    non: "لا",
    tranches: { "0_30": "0 – 30 يومًا", "31_90": "31 – 90 يومًا", "91_180": "91 – 180 يومًا", PLUS_180: "> 180 يومًا" } as Record<string, string>,
    reserve: "5. صندوق الاحتياط",
    mouvement: "الحركة",
    aucunMouvement: "لا توجد حركات خلال السنة المالية.",
    faits: "6. الأحداث البارزة",
    incidents: "الحوادث المُبلَّغ عنها",
    incidentsMajeurs: "حوادث ذات استعجال أقصى",
    agTenues: "الجمعيات العامة المنعقدة",
    contratsSignes: "العقود المُوقَّعة",
    aucun: "لا شيء",
    resolutions: "قرار(ات)",
    quorum: "النصاب",
    signatures: "7. المصادقة",
    signatureSyndic: "السنديك",
    signaturePresident: "رئيس المجلس النقابي",
    mentionApprobation: "تقرير معروض على مصادقة الجمعية العامة (القانون 18-00، تقديم الحسابات).",
    pied: "SyndicUp — تقرير مُنشأ من السجلات غير القابلة للتعديل (الدفعات، المصاريف، صندوق الاحتياط). المبالغ بالدرهم مع احتساب الرسوم.",
    releve: "كشف التحملات",
    etatDate: "الوضعية المؤرَّخة للوحدة",
    proprietaires: "المالك (المالكون)",
    periode: "الفترة",
    type: "النوع",
    du: "المستحق",
    paye: "المدفوع",
    statut: "الحالة",
    echeance: "تاريخ الاستحقاق",
    appels: "طلبات الأموال للسنة المالية",
    paiements: "دفعات السنة المالية",
    methode: "الطريقة",
    reference: "المرجع",
    soldeExercice: "رصيد السنة المالية",
    soldeGlobal: "إجمالي المستحق (كل السنوات)",
    enAttente: "تصريحات دفع في انتظار التحقق",
    aucuneLigne: "لا توجد سطور.",
    mentionReleve: "وثيقة مُحرَّرة بتاريخ الإصدار من سجلات الملكية المشتركة؛ لا تُعدّ وصلًا بالمبالغ المتبقية.",
  },
} as const;
export type Dico = (typeof DICO)["fr"];

// ── Styles & composants ───────────────────────────────────────────────────────────────────────

export function stylesPdf(langue: LanguePdf) {
  const f = familles(langue);
  const rtl = langue === "ar";
  return StyleSheet.create({
    page: { padding: 44, fontSize: 10, fontFamily: f.normal, color: "#111", direction: rtl ? "rtl" : "ltr" } as never,
    texte: { textAlign: rtl ? "right" : "left" },
    entete: { flexDirection: rtl ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1 solid #ddd", paddingBottom: 12, marginBottom: 16 },
    marque: { fontSize: 15, fontFamily: f.gras, fontWeight: 700 },
    sous: { fontSize: 9, color: "#555", marginTop: 2 },
    titre: { fontSize: 15, fontFamily: f.gras, fontWeight: 700, textAlign: rtl ? "left" : "right" },
    h2: { fontSize: 12, fontFamily: f.gras, fontWeight: 700, marginTop: 14, marginBottom: 6, textAlign: rtl ? "right" : "left" },
    h3: { fontSize: 10, fontFamily: f.gras, fontWeight: 700, marginTop: 8, marginBottom: 4, color: "#333", textAlign: rtl ? "right" : "left" },
    kv: { flexDirection: rtl ? "row-reverse" : "row", justifyContent: "space-between", paddingVertical: 2.5, borderBottom: "0.5 solid #eee" },
    kvLabel: { color: "#444", flex: 1, textAlign: rtl ? "right" : "left" },
    kvValeur: { fontFamily: f.gras, fontWeight: 700, textAlign: rtl ? "left" : "right", minWidth: 110 },
    note: { fontSize: 8, color: "#666", marginTop: 6, lineHeight: 1.4, textAlign: rtl ? "right" : "left" },
    alerte: { fontSize: 8.5, color: "#7a4b00", backgroundColor: "#fff6e5", padding: 6, marginTop: 6, borderRadius: 3, textAlign: rtl ? "right" : "left" },
    tEntete: { flexDirection: rtl ? "row-reverse" : "row", borderBottom: "1 solid #999", paddingBottom: 3, marginTop: 4, fontFamily: f.gras, fontWeight: 700, fontSize: 8, color: "#555" },
    tLigne: { flexDirection: rtl ? "row-reverse" : "row", paddingVertical: 3, borderBottom: "0.5 solid #eee", fontSize: 8.5 },
    tTotal: { flexDirection: rtl ? "row-reverse" : "row", paddingVertical: 4, borderTop: "1 solid #999", fontFamily: f.gras, fontWeight: 700, fontSize: 8.5 },
    signatures: { flexDirection: rtl ? "row-reverse" : "row", justifyContent: "space-between", marginTop: 28 },
    signature: { width: "45%", borderTop: "1 solid #999", paddingTop: 6, fontSize: 9, textAlign: "center" },
    pied: { position: "absolute", bottom: 20, left: 44, right: 44, fontSize: 7, color: "#666", textAlign: "center" },
    logo: { width: 56, height: 56, objectFit: "contain", marginBottom: 4 } as never,
  });
}
export type StylesPdf = ReturnType<typeof stylesPdf>;

export function Kv({ s, label, valeur }: { s: StylesPdf; label: string; valeur: string }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={s.kvValeur}>{valeur}</Text>
    </View>
  );
}

export interface Colonne {
  cle: string;
  titre: string;
  largeur: string;
  align?: "left" | "right" | "center";
}

/** Tableau simple ; en RTL, l'ordre des colonnes est inversé par `row-reverse` et les alignements par défaut suivent le sens de lecture. */
export function Tableau({ s, langue, colonnes, lignes, total }: { s: StylesPdf; langue: LanguePdf; colonnes: Colonne[]; lignes: Record<string, string | number | null | undefined>[]; total?: Record<string, string | number | null | undefined> }) {
  const rtl = langue === "ar";
  const align = (c: Colonne): "left" | "right" | "center" => {
    if (c.align === "center") return "center";
    const base = c.align ?? "left";
    if (!rtl) return base;
    return base === "left" ? "right" : "left";
  };
  return (
    <View>
      <View style={s.tEntete}>
        {colonnes.map((c) => (
          <Text key={c.cle} style={{ width: c.largeur, textAlign: align(c), paddingHorizontal: 2 }}>
            {c.titre}
          </Text>
        ))}
      </View>
      {lignes.map((l, i) => (
        <View key={i} style={s.tLigne} wrap={false}>
          {colonnes.map((c) => (
            <Text key={c.cle} style={{ width: c.largeur, textAlign: align(c), paddingHorizontal: 2 }}>
              {l[c.cle] === null || l[c.cle] === undefined || l[c.cle] === "" ? "—" : String(l[c.cle])}
            </Text>
          ))}
        </View>
      ))}
      {total ? (
        <View style={s.tTotal}>
          {colonnes.map((c) => (
            <Text key={c.cle} style={{ width: c.largeur, textAlign: align(c), paddingHorizontal: 2 }}>
              {total[c.cle] === undefined || total[c.cle] === null ? "" : String(total[c.cle])}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
