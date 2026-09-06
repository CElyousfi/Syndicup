/**
 * PDF de fiche de paie — M20. Rendu d'un instantané `fiche_paie.details_json` (aide au calcul interne,
 * FR / AR via le socle pdf-commun). Mention obligatoire : « document généré par SyndicUp à partir des
 * paramètres saisis par le syndic » — jamais présenté comme un bulletin certifié.
 */
import React from "react";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { Kv, Tableau, enregistrerPolices, formatDate, formatMad, stylesPdf } from "../rapports/pdf-commun";
import type { ResultatPaie } from "./paie";

const L = {
  fr: { titre: "Fiche de paie", periode: "Période", employe: "Employé", poste: "Poste", cnss: "N° CNSS", contrat: "Contrat", embauche: "Embauche", brut: "Salaire brut", primes: "Primes", retenueAbs: "Retenue absences", base: "Base de cotisation", cotSal: "Cotisations salariales", cotPat: "Charges patronales", libelle: "Libellé", montant: "Montant", cnssL: "CNSS", amo: "AMO", ir: "IR (impôt sur le revenu)", fraisPro: "Frais professionnels", netImposable: "Net imposable", retenues: "Autres retenues", net: "NET À PAYER", coutTotal: "Coût total employeur", allocFam: "Allocations familiales", formation: "Formation professionnelle", total: "Total", sousSmig: "Attention : salaire brut inférieur au SMIG paramétré.", mention: "Document généré par SyndicUp à partir des paramètres saisis par le syndic (aide au calcul interne). Il ne constitue pas un bulletin de paie certifié ; les taux et barèmes appliqués sont ceux configurés par la copropriété.", genereLe: "Généré le", statut: "Statut" },
  ar: { titre: "قسيمة الأجر", periode: "الفترة", employe: "المستخدَم", poste: "الوظيفة", cnss: "رقم الضمان الاجتماعي", contrat: "العقد", embauche: "التوظيف", brut: "الأجر الإجمالي", primes: "المنح", retenueAbs: "خصم الغياب", base: "أساس الاشتراك", cotSal: "اشتراكات الأجير", cotPat: "تحملات المشغِّل", libelle: "البيان", montant: "المبلغ", cnssL: "الضمان الاجتماعي", amo: "التأمين الإجباري عن المرض", ir: "الضريبة على الدخل", fraisPro: "المصاريف المهنية", netImposable: "الصافي الخاضع للضريبة", retenues: "خصومات أخرى", net: "الصافي المستحق", coutTotal: "الكلفة الإجمالية للمشغِّل", allocFam: "التعويضات العائلية", formation: "التكوين المهني", total: "المجموع", sousSmig: "تنبيه: الأجر الإجمالي أقل من الحد الأدنى المُحدد.", mention: "وثيقة مُنشأة بواسطة SyndicUp من المعطيات المُدخلة من طرف السنديك (مساعدة على الحساب داخلية). لا تُعد قسيمة أجر مُصادقًا عليها؛ النسب والجداول المطبقة هي تلك المُهيّأة من طرف الملكية المشتركة.", genereLe: "أُنشئت بتاريخ", statut: "الحالة" },
} as const;

export interface DonneesFichePaiePdf {
  fiche: { id: string; periode: string; statut: string; creeLe: Date | string; valideLe?: Date | string | null };
  resultat: ResultatPaie;
  personnel: { poste: string; typeContrat: string | null; dateEmbauche: Date | null; numeroCnss: string | null; utilisateur: { nom: string | null; prenom: string | null } | null };
  copropriete: { nom: string; adresse: string; ville: string };
}

function Doc({ d, langue }: { d: DonneesFichePaiePdf; langue: "fr" | "ar" }) {
  const t = L[langue];
  const s = stylesPdf(langue);
  const mad = (v: string | null | undefined) => formatMad(v, langue);
  const r = d.resultat;
  const nom = d.personnel.utilisateur ? [d.personnel.utilisateur.prenom, d.personnel.utilisateur.nom].filter(Boolean).join(" ") || d.personnel.poste : d.personnel.poste;
  const cnss = d.personnel.numeroCnss ? `${"•".repeat(Math.max(0, d.personnel.numeroCnss.length - 4))}${d.personnel.numeroCnss.slice(-4)}` : "—";
  return (
    <Document title={`${t.titre} ${d.fiche.periode} — ${nom}`} author="SyndicUp" language={langue}>
      <Page size="A4" style={s.page}>
        <View style={s.entete}>
          <View><Text style={s.marque}>{d.copropriete.nom}</Text><Text style={s.sous}>{d.copropriete.adresse}, {d.copropriete.ville}</Text></View>
          <View><Text style={s.titre}>{t.titre}</Text><Text style={[s.sous, s.titre, { fontSize: 11 }]}>{t.periode} {d.fiche.periode}</Text><Text style={[s.sous, s.titre, { fontSize: 8 }]}>{t.statut} : {d.fiche.statut}</Text></View>
        </View>
        <Text style={s.h2}>{t.employe}</Text>
        <Kv s={s} label={t.employe} valeur={nom} />
        <Kv s={s} label={t.poste} valeur={d.personnel.poste} />
        <Kv s={s} label={t.contrat} valeur={d.personnel.typeContrat ?? "—"} />
        <Kv s={s} label={t.embauche} valeur={d.personnel.dateEmbauche ? formatDate(new Date(d.personnel.dateEmbauche).toISOString(), langue) : "—"} />
        <Kv s={s} label={t.cnss} valeur={cnss} />

        <Text style={s.h2}>{t.brut}</Text>
        <Kv s={s} label={t.brut} valeur={mad(r.brut)} />
        {r.primes !== "0.00" ? <Kv s={s} label={t.primes} valeur={mad(r.primes)} /> : null}
        {r.retenue_absences !== "0.00" ? <Kv s={s} label={`${t.retenueAbs} (${r.jours_absence_injustifiee} j)`} valeur={`− ${mad(r.retenue_absences)}`} /> : null}
        <Kv s={s} label={t.base} valeur={mad(r.base_cotisations)} />
        {r.sous_smig ? <Text style={s.alerte}>{t.sousSmig}</Text> : null}

        <Text style={s.h2}>{t.cotSal}</Text>
        <Tableau s={s} langue={langue} colonnes={[{ cle: "l", titre: t.libelle, largeur: "70%" }, { cle: "m", titre: t.montant, largeur: "30%", align: "right" }]}
          lignes={[
            { l: `${t.cnssL} (${r.parametres.taux_cnss_salarial} %)`, m: mad(r.cotisations_salariales.cnss) },
            { l: `${t.amo} (${r.parametres.taux_amo_salarial} %)`, m: mad(r.cotisations_salariales.amo) },
            { l: `${t.fraisPro} (${r.parametres.taux_frais_professionnels} %) → ${t.netImposable} ${mad(r.net_imposable)}`, m: "" },
            { l: `${t.ir} (${r.tranche_ir.taux} %)`, m: mad(r.cotisations_salariales.ir) },
            ...(r.retenues !== "0.00" ? [{ l: t.retenues, m: mad(r.retenues) }] : []),
          ]}
          total={{ l: t.total, m: mad(r.cotisations_salariales.total) }} />
        <View style={{ marginTop: 10 }}>
          <Kv s={s} label={t.net} valeur={mad(r.net)} />
        </View>

        <Text style={s.h2}>{t.cotPat}</Text>
        <Tableau s={s} langue={langue} colonnes={[{ cle: "l", titre: t.libelle, largeur: "70%" }, { cle: "m", titre: t.montant, largeur: "30%", align: "right" }]}
          lignes={[
            { l: `${t.cnssL} (${r.parametres.taux_cnss_patronal} %)`, m: mad(r.cotisations_patronales.cnss) },
            { l: `${t.allocFam} (${r.parametres.taux_allocations_familiales} %)`, m: mad(r.cotisations_patronales.allocations_familiales) },
            { l: `${t.amo} (${r.parametres.taux_amo_patronal} %)`, m: mad(r.cotisations_patronales.amo) },
            { l: `${t.formation} (${r.parametres.taux_formation_pro} %)`, m: mad(r.cotisations_patronales.formation_pro) },
          ]}
          total={{ l: t.total, m: mad(r.cotisations_patronales.total) }} />
        <Kv s={s} label={t.coutTotal} valeur={mad(r.cout_total_employeur)} />
        <Text style={s.note}>{t.genereLe} {formatDate(new Date().toISOString(), langue)}{r.parametres.source ? ` — ${r.parametres.source}` : ""}</Text>
        <Text style={s.alerte}>{t.mention}</Text>
        <Text style={s.pied} fixed>{t.mention}</Text>
      </Page>
    </Document>
  );
}

export async function genererFichePaiePdf(d: DonneesFichePaiePdf, langue: "fr" | "ar"): Promise<Buffer> {
  enregistrerPolices();
  return renderToBuffer(<Doc d={d} langue={langue} />);
}
