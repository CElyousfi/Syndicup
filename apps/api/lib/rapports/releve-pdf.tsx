/** PDF du relevé de charges par lot (« état daté », Doc A §11) — M18, FR / AR. Rendu de `ReleveLot`. */
import React from "react";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { LanguePdf } from "./schemas";
import type { ReleveLot } from "./releve";
import { DICO, Kv, Tableau, enregistrerPolices, formatDate, formatMad, stylesPdf } from "./pdf-commun";

function ReleveDocument({ r, langue }: { r: ReleveLot; langue: LanguePdf }) {
  const t = DICO[langue];
  const s = stylesPdf(langue);
  const mad = (v: string | null | undefined) => formatMad(v, langue);
  return (
    <Document title={`${t.releve} — ${r.lot.numero} — ${r.exercice}`} author="SyndicUp" language={langue}>
      <Page size="A4" style={s.page}>
        <View style={s.entete}>
          <View>
            <Text style={s.marque}>{r.copropriete.nom}</Text>
            <Text style={s.sous}>{r.copropriete.adresse}, {r.copropriete.ville}</Text>
          </View>
          <View>
            <Text style={s.titre}>{t.releve}</Text>
            <Text style={[s.sous, s.titre, { fontSize: 10 }]}>{t.exercice} {r.exercice}</Text>
            <Text style={[s.sous, s.titre, { fontSize: 8 }]}>{t.genereLe} {formatDate(r.emis_le, langue)}</Text>
          </View>
        </View>

        <Text style={s.h2}>{t.etatDate}</Text>
        <Kv s={s} label={t.lot} valeur={`${r.lot.type_lot} ${r.lot.numero}${r.lot.etage !== null ? ` (${r.lot.etage})` : ""} — ${r.lot.tantiemes}`} />
        <Kv s={s} label={t.proprietaires} valeur={r.proprietaires.length === 0 ? "—" : r.proprietaires.map((p) => `${[p.prenom, p.nom].filter(Boolean).join(" ")} (${p.quote_part} %)`).join(", ")} />
        <Kv s={s} label={t.soldeExercice} valeur={mad(r.totaux.solde_exercice)} />
        <Kv s={s} label={t.soldeGlobal} valeur={mad(r.totaux.solde_total_du)} />
        <Kv s={s} label={t.enAttente} valeur={mad(r.totaux.en_attente)} />

        <Text style={s.h2}>{t.appels}</Text>
        {r.appels.length === 0 ? (
          <Text style={s.note}>{t.aucuneLigne}</Text>
        ) : (
          <Tableau
            s={s}
            langue={langue}
            colonnes={[
              { cle: "periode", titre: t.periode, largeur: "13%" },
              { cle: "type", titre: t.type, largeur: "24%" },
              { cle: "echeance", titre: t.echeance, largeur: "15%" },
              { cle: "du", titre: t.du, largeur: "16%", align: "right" },
              { cle: "paye", titre: t.paye, largeur: "16%", align: "right" },
              { cle: "statut", titre: t.statut, largeur: "16%", align: "center" },
            ]}
            lignes={r.appels.map((a) => ({ periode: a.periode, type: a.type, echeance: formatDate(a.date_echeance, langue), du: mad(a.montant_du), paye: mad(a.montant_paye), statut: `${a.statut}${a.conteste ? " *" : ""}` }))}
            total={{ periode: t.total, du: mad(r.totaux.appele), paye: mad(r.totaux.paye) }}
          />
        )}

        <Text style={s.h2}>{t.paiements}</Text>
        {r.paiements.length === 0 ? (
          <Text style={s.note}>{t.aucuneLigne}</Text>
        ) : (
          <Tableau
            s={s}
            langue={langue}
            colonnes={[
              { cle: "date", titre: t.date, largeur: "18%" },
              { cle: "periode", titre: t.periode, largeur: "16%" },
              { cle: "methode", titre: t.methode, largeur: "20%" },
              { cle: "reference", titre: t.reference, largeur: "26%" },
              { cle: "montant", titre: t.montant, largeur: "20%", align: "right" },
            ]}
            lignes={r.paiements.map((p) => ({ date: formatDate(p.date, langue), periode: p.periode, methode: p.methode, reference: p.reference, montant: mad(p.montant) }))}
          />
        )}

        {r.justificatifs_en_attente.length > 0 ? (
          <View>
            <Text style={s.h2}>{t.enAttente}</Text>
            <Tableau
              s={s}
              langue={langue}
              colonnes={[
                { cle: "date", titre: t.date, largeur: "25%" },
                { cle: "methode", titre: t.methode, largeur: "25%" },
                { cle: "reference", titre: t.reference, largeur: "30%" },
                { cle: "montant", titre: t.montant, largeur: "20%", align: "right" },
              ]}
              lignes={r.justificatifs_en_attente.map((j) => ({ date: formatDate(j.date_paiement, langue), methode: j.methode, reference: j.reference, montant: mad(j.montant) }))}
            />
          </View>
        ) : null}

        <Text style={s.note}>{t.mentionReleve}</Text>
        <Text style={s.pied} fixed>{t.pied}</Text>
      </Page>
    </Document>
  );
}

export async function genererRelevePdf(r: ReleveLot, langue: LanguePdf): Promise<Buffer> {
  enregistrerPolices();
  return renderToBuffer(<ReleveDocument r={r} langue={langue} />);
}
