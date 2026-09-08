/**
 * Lecture et normalisation d'un tableur (xlsx / csv) — M24. Détection des colonnes par synonymes
 * d'en-tête FR / AR / EN, tolérance aux tableurs « sales » : lignes vides, cellules fusionnées
 * (valeur héritée de la ligne précédente pour les colonnes clés), téléphones avec espaces,
 * tantièmes « 25/1000 », montants « 1 250,50 », dates Excel (numéro de série) ou texte.
 */
import ExcelJS from "exceljs";
import type { TypeImport } from "./schemas";

export type Ligne = { n: number; valeurs: string[] };
export type Tableur = { entetes: string[]; lignes: Ligne[]; feuille: string };

/** Champs cibles par type d'import — libellés FR/AR pour les modèles et l'UI. */
export interface ChampImport {
  cle: string;
  requis: boolean;
  synonymes: string[];
  libelle: { FR: string; AR: string };
  exemple: string;
}
const T = (cle: string, requis: boolean, FR: string, AR: string, exemple: string, synonymes: string[]): ChampImport => ({ cle, requis, libelle: { FR, AR }, exemple, synonymes });

export const CHAMPS: Record<TypeImport, ChampImport[]> = {
  LOTS_PROPRIETAIRES: [
    T("numero", true, "N° lot", "رقم الشقة", "A1", ["n° lot", "no lot", "numero lot", "numéro lot", "numero", "lot", "appartement", "appt", "apt", "unit", "unité", "الشقة", "رقم الشقة", "رقم", "الحصة", "lot number", "flat", "porte"]),
    T("type_lot", false, "Type de lot", "نوع الحصة", "APPARTEMENT", ["type lot", "type de lot", "type", "nature", "نوع", "نوع الحصة", "lot type"]),
    T("etage", false, "Étage", "الطابق", "3", ["étage", "etage", "niveau", "floor", "الطابق"]),
    T("batiment", false, "Bâtiment", "العمارة", "A", ["bâtiment", "batiment", "bloc", "immeuble", "tour", "building", "block", "العمارة", "البناية"]),
    T("tantiemes", true, "Tantièmes", "الأجزاء", "250", ["tantièmes", "tantiemes", "tantième", "quote-part", "quote part", "quotepart", "millièmes", "milliemes", "millième", "parts", "part", "الأجزاء", "الحصص", "النصيب", "shares", "share", "quota"]),
    T("superficie", false, "Superficie (m²)", "المساحة", "85", ["superficie", "surface", "m2", "m²", "المساحة", "area"]),
    T("nom", false, "Nom du propriétaire", "اسم المالك", "Bennani", ["propriétaire", "proprietaire", "nom", "nom propriétaire", "nom du propriétaire", "owner", "name", "المالك", "اسم", "الاسم", "الاسم العائلي", "nom complet", "full name", "titulaire"]),
    T("prenom", false, "Prénom", "الاسم الشخصي", "Amina", ["prénom", "prenom", "first name", "الاسم الشخصي"]),
    T("telephone", false, "Téléphone", "الهاتف", "0612345678", ["téléphone", "telephone", "tel", "tél", "gsm", "mobile", "portable", "phone", "الهاتف", "هاتف", "الجوال", "رقم الهاتف"]),
    T("email", false, "E-mail", "البريد الإلكتروني", "amina@example.ma", ["email", "e-mail", "mail", "courriel", "البريد", "البريد الإلكتروني"]),
    T("quote_part", false, "Quote-part (%)", "نسبة الملكية", "100", ["quote-part propriété", "quote part propriété", "% propriété", "pourcentage", "part propriété", "quote-part %", "نسبة", "نسبة الملكية", "ownership %", "indivision"]),
    T("type_propriete", false, "Type de propriété", "نوع الملكية", "PLEIN", ["type propriété", "type de propriété", "propriété", "nature propriété", "نوع الملكية"]),
    T("langue", false, "Langue", "اللغة", "FR", ["langue", "language", "اللغة"]),
  ],
  SOLDES_OUVERTURE: [
    T("numero", true, "N° lot", "رقم الشقة", "A1", ["n° lot", "no lot", "numero lot", "numéro lot", "numero", "lot", "appartement", "appt", "apt", "unit", "unité", "flat", "الشقة", "رقم الشقة", "رقم"]),
    T("montant", true, "Solde (MAD, + dû / − avoir)", "الرصيد", "1250.00", ["solde", "reste à payer", "reste a payer", "reste du", "reste dû", "montant", "dû", "du", "impayé", "impayes", "arriérés", "arrieres", "balance", "amount due", "الرصيد", "المبلغ", "المتأخرات", "الباقي", "avoir", "crédit"]),
    T("date_reference", false, "Date de référence", "تاريخ المرجع", "2026-01-01", ["date", "date référence", "date reference", "au", "arrêté au", "arrete au", "as of", "التاريخ"]),
    T("commentaire", false, "Commentaire", "تعليق", "Arriérés 2025", ["commentaire", "observation", "remarque", "note", "détail", "detail", "ملاحظة", "تعليق", "comment"]),
  ],
  PRESTATAIRES: [
    T("nom", true, "Nom", "الاسم", "Otis Maroc", ["nom", "prestataire", "fournisseur", "société", "societe", "raison sociale", "entreprise", "name", "supplier", "vendor", "الاسم", "المورد", "الشركة"]),
    T("specialite", true, "Spécialité", "التخصص", "Ascenseur", ["spécialité", "specialite", "métier", "metier", "activité", "activite", "domaine", "service", "التخصص", "المجال", "trade"]),
    T("telephone", false, "Téléphone", "الهاتف", "0522000000", ["téléphone", "telephone", "tel", "tél", "gsm", "mobile", "phone", "contact", "الهاتف", "هاتف"]),
    T("email", false, "E-mail", "البريد الإلكتروني", "contact@otis.ma", ["email", "e-mail", "mail", "courriel", "البريد"]),
    T("ice", false, "ICE", "ICE", "001234567000089", ["ice", "identifiant commun", "التعريف الموحد"]),
    T("rc", false, "RC", "السجل التجاري", "12345", ["rc", "registre commerce", "registre du commerce", "السجل التجاري"]),
    T("adresse", false, "Adresse", "العنوان", "Casablanca", ["adresse", "address", "العنوان"]),
    T("notes", false, "Notes", "ملاحظات", "", ["notes", "note", "observation", "remarque", "ملاحظات"]),
  ],
  CONTRATS: [
    T("libelle", true, "Libellé", "التسمية", "Maintenance ascenseur", ["libellé", "libelle", "objet", "intitulé", "intitule", "contrat", "désignation", "designation", "التسمية", "الموضوع", "title", "description"]),
    T("type", true, "Type", "النوع", "ASCENSEUR", ["type", "catégorie", "categorie", "nature", "النوع", "الصنف"]),
    T("prestataire", false, "Prestataire", "المورد", "Otis Maroc", ["prestataire", "fournisseur", "société", "societe", "المورد", "الشركة", "supplier"]),
    T("date_debut", true, "Date de début", "تاريخ البداية", "2026-01-01", ["date début", "date debut", "début", "debut", "start", "du", "تاريخ البداية", "من"]),
    T("date_fin", false, "Date de fin", "تاريخ النهاية", "2026-12-31", ["date fin", "fin", "échéance", "echeance", "end", "au", "jusqu'au", "تاريخ النهاية", "إلى"]),
    T("periodicite", false, "Périodicité", "الدورية", "MENSUELLE", ["périodicité", "periodicite", "fréquence", "frequence", "الدورية", "frequency"]),
    T("montant_periode", false, "Montant par période", "المبلغ", "1500.00", ["montant", "prix", "coût", "cout", "loyer", "المبلغ", "amount", "montant période", "montant mensuel"]),
    T("reference", false, "Référence", "المرجع", "CT-2026-01", ["référence", "reference", "n° contrat", "numéro", "numero", "ref", "المرجع", "رقم"]),
    T("tacite", false, "Tacite reconduction", "تجديد ضمني", "oui", ["tacite", "reconduction", "renouvellement automatique", "تجديد"]),
    T("notes", false, "Notes", "ملاحظات", "", ["notes", "note", "observation", "remarque", "ملاحظات"]),
  ],
  VEHICULES_BADGES: [
    T("numero", true, "N° lot", "رقم الشقة", "A1", ["n° lot", "no lot", "numero lot", "numéro lot", "numero", "lot", "appartement", "appt", "apt", "unit", "unité", "الشقة", "رقم الشقة"]),
    T("immatriculation", false, "Immatriculation", "رقم اللوحة", "12345-A-6", ["immatriculation", "plaque", "matricule", "véhicule", "vehicule", "plate", "رقم اللوحة", "اللوحة", "السيارة"]),
    T("marque", false, "Marque", "العلامة", "Dacia Logan", ["marque", "modèle", "modele", "brand", "model", "العلامة", "الطراز"]),
    T("couleur", false, "Couleur", "اللون", "Blanc", ["couleur", "color", "اللون"]),
    T("type_vehicule", false, "Type de véhicule", "نوع السيارة", "VOITURE", ["type véhicule", "type vehicule", "type", "نوع السيارة"]),
    T("badge_type", false, "Type de badge", "نوع الشارة", "TELECOMMANDE_PARKING", ["type badge", "badge type", "type de badge", "نوع الشارة"]),
    T("badge_identifiant", false, "Identifiant du badge", "معرّف الشارة", "TC-0007", ["badge", "identifiant badge", "n° badge", "numéro badge", "télécommande", "telecommande", "clé", "cle", "الشارة", "معرّف الشارة", "رقم الشارة"]),
    T("caution", false, "Caution (MAD)", "الضمان", "300.00", ["caution", "dépôt", "depot", "garantie", "الضمان", "deposit"]),
  ],
  PERSONNEL: [
    T("nom", true, "Nom", "الاسم العائلي", "Ouazzani", ["nom", "employé", "employe", "salarié", "salarie", "gardien", "name", "الاسم", "الاسم العائلي", "الموظف"]),
    T("prenom", false, "Prénom", "الاسم الشخصي", "Rachid", ["prénom", "prenom", "first name", "الاسم الشخصي"]),
    T("telephone", true, "Téléphone", "الهاتف", "0612345678", ["téléphone", "telephone", "tel", "tél", "gsm", "mobile", "phone", "الهاتف", "هاتف"]),
    T("email", false, "E-mail", "البريد الإلكتروني", "", ["email", "e-mail", "mail", "البريد"]),
    T("poste", false, "Poste", "المنصب", "GARDIEN", ["poste", "fonction", "emploi", "métier", "metier", "المنصب", "الوظيفة", "job", "position"]),
    T("date_embauche", false, "Date d'embauche", "تاريخ التوظيف", "2024-01-15", ["date embauche", "date d'embauche", "embauche", "entrée", "entree", "depuis", "تاريخ التوظيف", "hire date"]),
    T("salaire_brut_mensuel", false, "Salaire brut mensuel", "الأجر الإجمالي", "3500.00", ["salaire", "salaire brut", "brut", "rémunération", "remuneration", "الأجر", "الراتب", "salary"]),
    T("numero_cnss", false, "N° CNSS", "رقم الضمان الاجتماعي", "123456789", ["cnss", "n° cnss", "numéro cnss", "immatriculation cnss", "الضمان الاجتماعي"]),
  ],
};

// ── Normalisation ─────────────────────────────────────────────────────────────

/** Minuscules, sans accents ni ponctuation — comparaison d'en-têtes. */
export function normaliserEntete(v: string): string {
  return v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();
}
/** Détection automatique des colonnes : correspondance exacte d'abord, puis inclusion, sans doublon de champ. */
export function detecterMapping(type: TypeImport, entetes: string[]): { index: number; entete: string; champ: string | null }[] {
  const champs = CHAMPS[type];
  const pris = new Set<string>();
  const normalisees = entetes.map(normaliserEntete);
  const resultat: { index: number; entete: string; champ: string | null }[] = entetes.map((e, i) => ({ index: i, entete: e, champ: null }));
  // Passe 1 : égalité stricte avec un synonyme.
  for (const [i, n] of normalisees.entries()) {
    if (!n) continue;
    const c = champs.find((ch) => !pris.has(ch.cle) && ch.synonymes.some((s) => normaliserEntete(s) === n));
    if (c) { resultat[i]!.champ = c.cle; pris.add(c.cle); }
  }
  // Passe 2 : le synonyme est contenu dans l'en-tête (« Nom du propriétaire (obligatoire) »), les plus longs d'abord.
  for (const [i, n] of normalisees.entries()) {
    if (!n || resultat[i]!.champ) continue;
    const candidats = champs.filter((ch) => !pris.has(ch.cle)).flatMap((ch) => ch.synonymes.map((s) => ({ ch, s: normaliserEntete(s) }))).filter((x) => x.s.length >= 3 && n.includes(x.s)).sort((a, b) => b.s.length - a.s.length);
    if (candidats[0]) { resultat[i]!.champ = candidats[0].ch.cle; pris.add(candidats[0].ch.cle); }
  }
  return resultat;
}

export function normaliserTelephone(v: string | null | undefined): string | null {
  if (!v) return null;
  let s = v.replace(/[\s.\-()]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (/^0[5-7]\d{8}$/.test(s)) s = `+212${s.slice(1)}`;
  else if (/^[5-7]\d{8}$/.test(s)) s = `+212${s}`;
  else if (/^212[5-7]\d{8}$/.test(s)) s = `+${s}`;
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
}
/** Décimal : « 1 250,50 », « 1.250,50 », « 25/1000 » (→ 25), « 2,5 % » (→ 2.5). */
export function normaliserDecimal(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  let s = String(v).trim().replace(/ /g, " ");
  if (!s || s === "-" || s === "—") return null;
  const frac = s.match(/^\s*(-?[\d\s.,]+)\s*\/\s*([\d\s.,]+)\s*$/);
  if (frac) s = frac[1]!;
  s = s.replace(/[%\sMADmadDHdh]/g, "");
  const negatif = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()\-+]/g, "");
  if (/,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return (negatif ? -n : n).toFixed(2);
}
export function normaliserEntier(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = String(v).trim().match(/^-?\d+/);
  if (!m) return /^(rdc|rez|ground|0)$/i.test(String(v).trim()) ? 0 : null;
  return Number(m[0]);
}
/** Date : ISO, « 15/01/2026 », « 15-01-2026 », « 2026/01/15 », numéro de série Excel. */
export function normaliserDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  m = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  if (/^\d{4,6}$/.test(s)) { const n = Number(s); if (n > 20000 && n < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + n * 86_400_000); return d.toISOString().slice(0, 10); } }
  return null;
}
export function normaliserBooleen(v: string | null | undefined): boolean | null {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (["oui", "o", "yes", "y", "true", "1", "x", "✓", "نعم"].includes(s)) return true;
  if (["non", "n", "no", "false", "0", "لا"].includes(s)) return false;
  return null;
}
/** Valeur d'énumération : accents / casse / espaces neutralisés, alias FR/AR. */
export function normaliserEnum(v: string | null | undefined, valeurs: readonly string[], alias: Record<string, string> = {}): string | null {
  if (!v) return null;
  const n = normaliserEntete(String(v)).replace(/\s+/g, "_").toUpperCase();
  if (valeurs.includes(n)) return n;
  const a = alias[normaliserEntete(String(v))];
  if (a && valeurs.includes(a)) return a;
  const partiel = valeurs.find((x) => normaliserEntete(x).replace(/_/g, " ").includes(normaliserEntete(String(v))));
  return partiel ?? null;
}

// ── Lecture ──────────────────────────────────────────────────────────────────

function celluleTexte(c: ExcelJS.Cell): string {
  const v = c.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: string; result?: unknown; hyperlink?: string; formula?: string };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined && o.result !== null) return o.result instanceof Date ? (o.result as Date).toISOString().slice(0, 10) : String(o.result);
    return "";
  }
  return String(v).trim();
}

/** CSV minimal (séparateur ; , ou tabulation détecté, guillemets, BOM). */
export function lireCsv(texte: string): string[][] {
  const t = texte.replace(/^\uFEFF/, "");
  const premiere = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", ",", "\t"].map((s) => ({ s, n: premiere.split(s).length })).sort((a, b) => b.n - a.n)[0]!.s;
  const lignes: string[][] = [];
  let ligne: string[] = [], champ = "", guillemets = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (guillemets) {
      if (ch === '"') { if (t[i + 1] === '"') { champ += '"'; i++; } else guillemets = false; }
      else champ += ch;
    } else if (ch === '"') guillemets = true;
    else if (ch === sep) { ligne.push(champ.trim()); champ = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; ligne.push(champ.trim()); lignes.push(ligne); ligne = []; champ = ""; }
    else champ += ch;
  }
  if (champ.length || ligne.length) { ligne.push(champ.trim()); lignes.push(ligne); }
  return lignes;
}

/** Lit la première feuille non vide ; la ligne d'en-tête = première ligne ayant ≥ 2 cellules non vides. */
export async function lireTableur(buffer: Buffer, nomFichier: string): Promise<Tableur> {
  const csv = /\.csv$|\.txt$/i.test(nomFichier) || (!/\.xlsx?$/i.test(nomFichier) && buffer.subarray(0, 2).toString("hex") !== "504b");
  let brut: string[][] = [];
  let feuille = "csv";
  if (csv) {
    brut = lireCsv(buffer.toString("utf8"));
  } else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets.find((w) => w.rowCount > 0) ?? wb.worksheets[0];
    if (!ws) throw new Error("Classeur vide.");
    feuille = ws.name;
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const vals: string[] = [];
      const max = Math.max(row.cellCount, ws.columnCount);
      for (let c = 1; c <= max; c++) vals.push(celluleTexte(row.getCell(c)));
      brut[n - 1] = vals;
    });
    brut = brut.map((r) => r ?? []);
  }
  const nonVide = (r: string[]) => r.filter((x) => x && x.trim()).length;
  const iEntete = brut.findIndex((r) => nonVide(r) >= 2);
  if (iEntete < 0) throw new Error("Aucune ligne d'en-tête trouvée.");
  const entetes = brut[iEntete]!.map((h) => (h ?? "").trim());
  // Colonnes vides en fin d'en-tête ignorées ; cellules fusionnées : une valeur vide sous un en-tête
  // « clé » (première colonne) hérite de la ligne précédente.
  const largeur = entetes.reduce((m, h, i) => (h ? i + 1 : m), 0);
  const lignes: Ligne[] = [];
  let precedente: string[] | null = null;
  for (let i = iEntete + 1; i < brut.length; i++) {
    const r = (brut[i] ?? []).slice(0, largeur).map((x) => (x ?? "").trim());
    while (r.length < largeur) r.push("");
    if (nonVide(r) === 0) continue;
    if (!r[0] && precedente) r[0] = precedente[0]!;
    lignes.push({ n: i + 1, valeurs: r });
    precedente = r;
  }
  return { entetes: entetes.slice(0, largeur), lignes, feuille };
}

/** Modèle xlsx téléchargeable (en-têtes FR ou AR + une ligne d'exemple). */
export async function genererModele(type: TypeImport, langue: "FR" | "AR"): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(langue === "AR" ? "استيراد" : "Import", { views: [{ rightToLeft: langue === "AR" }] });
  const champs = CHAMPS[type];
  ws.addRow(champs.map((c) => `${c.libelle[langue]}${c.requis ? " *" : ""}`));
  ws.addRow(champs.map((c) => c.exemple));
  ws.getRow(1).font = { bold: true };
  ws.columns = champs.map((c) => ({ width: Math.max(14, c.libelle[langue].length + 4) }));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
