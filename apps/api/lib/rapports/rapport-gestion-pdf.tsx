/**
 * Rendu PDF du rapport de gestion — M18 (Doc A §8 reddition des comptes, §6 approbation en AG).
 * Le PDF est un RENDU de `rapport_gestion.donnees_json` (instantané figé) : reproductible, jamais
 * recalculé. Deux langues (FR / AR — bidi react-pdf), deux variantes : `complete` (syndic / conseil :
 * état des impayés nominatif par lot) et `publique` (AG / résidents : jamais de donnée par lot).
 * Logo de la copropriété et bloc de signatures syndic + président du conseil syndical.
 */
import React from "react";
import { Document, Image, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { LanguePdf } from "./schemas";
import { DICO, Kv, Tableau, enregistrerPolices, formatDate, formatMad, formatPourcent, stylesPdf, type StylesPdf } from "./pdf-commun";
import type { RapportGestionDonnees } from "./gestion-donnees";

export type VariantePdf = "complete" | "publique";

const MAX_DEPENSES = 60;

function Section({ s, titre, children }: { s: StylesPdf; titre: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={s.h2}>{titre}</Text>
      {children}
    </View>
  );
}

function RapportDocument({ d, langue, variante, logo }: { d: RapportGestionDonnees; langue: LanguePdf; variante: VariantePdf; logo?: { data: Buffer; format: "png" | "jpg" } }) {
  const t = DICO[langue];
  const s = stylesPdf(langue);
  const mad = (v: string | null | undefined) => formatMad(v, langue);
  const depenses = d.depenses.slice(0, MAX_DEPENSES);
  return (
    <Document title={`${t.rapportGestion} ${d.exercice} — ${d.copropriete.nom}`} author="SyndicUp" language={langue}>
      <Page size="A4" style={s.page}>
        <View style={s.entete}>
          <View>
            {logo ? <Image style={s.logo} src={logo} /> : null}
            <Text style={s.marque}>{d.copropriete.nom}</Text>
            <Text style={s.sous}>{d.copropriete.adresse}, {d.copropriete.ville}</Text>
            <Text style={s.sous}>{d.copropriete.nb_lots} lots</Text>
          </View>
          <View>
            <Text style={s.titre}>{t.rapportGestion}</Text>
            <Text style={[s.sous, s.titre, { fontSize: 11 }]}>{t.exercice} {d.exercice}</Text>
            <Text style={[s.sous, s.titre, { fontSize: 8 }]}>{t.genereLe} {formatDate(d.genere_le, langue)} {t.par} {d.syndic.nom ?? "—"}</Text>
          </View>
        </View>
        <Text style={s.note}>{variante === "complete" ? t.varianteComplete : t.variantePublique}</Text>

        <Section s={s} titre={t.synthese}>
          <Kv s={s} label={t.ouverture} valeur={mad(d.tresorerie.ouverture.compte_courant)} />
          <Kv s={s} label={t.entrees} valeur={mad(d.tresorerie.totaux.entrees)} />
          <Kv s={s} label={t.sortiesCourant} valeur={mad(d.tresorerie.totaux.sorties_compte_courant)} />
          <Kv s={s} label={t.cloture} valeur={mad(d.tresorerie.cloture.compte_courant)} />
          <Kv s={s} label={t.reserveOuverture} valeur={d.tresorerie.reserve_configuree ? mad(d.tresorerie.ouverture.reserve) : t.reserveNonConfiguree} />
          <Kv s={s} label={t.reserveCloture} valeur={d.tresorerie.reserve_configuree ? mad(d.tresorerie.cloture.reserve) : t.reserveNonConfiguree} />
          <Kv s={s} label={`${t.recouvrement} (${t.appele} ${mad(d.recouvrement.appele)} / ${t.encaisse} ${mad(d.recouvrement.encaisse)})`} valeur={formatPourcent(d.recouvrement.taux)} />
          <Kv s={s} label={`${t.impayesTotal} — ${d.impayes.nb_lots_en_retard} ${t.lotsEnRetard}`} valeur={mad(d.impayes.total)} />
          <Kv s={s} label={`${t.justificatifsAttente} (${d.justificatifs_en_attente.nb})`} valeur={mad(d.justificatifs_en_attente.montant)} />
          <Text style={s.note}>{t.avertissementEstimation}</Text>
          {d.seuil_approbation_non_configure ? <Text style={s.alerte}>{t.seuilNonConfigure}</Text> : null}
        </Section>

        <Section s={s} titre={t.budget}>
          {d.budget_vs_realise.budget ? (
            <Tableau
              s={s}
              langue={langue}
              colonnes={[
                { cle: "poste", titre: t.poste, largeur: "40%" },
                { cle: "prevu", titre: t.prevu, largeur: "17%", align: "right" },
                { cle: "realise", titre: t.realise, largeur: "17%", align: "right" },
                { cle: "ecart", titre: t.ecart, largeur: "16%", align: "right" },
                { cle: "taux", titre: t.taux, largeur: "10%", align: "right" },
              ]}
              lignes={[
                ...d.budget_vs_realise.postes.map((p) => ({ poste: p.libelle, prevu: mad(p.montant_prevu), realise: mad(p.realise), ecart: mad(p.ecart), taux: formatPourcent(p.pourcentage_realise) })),
                ...d.budget_vs_realise.hors_poste.map((h) => ({ poste: `${t.horsPoste} — ${h.categorie}`, prevu: "—", realise: mad(h.realise), ecart: "—", taux: "—" })),
              ]}
              total={{ poste: t.total, prevu: mad(d.budget_vs_realise.totaux.montant_prevu), realise: mad(d.budget_vs_realise.totaux.realise), ecart: mad(d.budget_vs_realise.totaux.ecart), taux: formatPourcent(d.budget_vs_realise.totaux.pourcentage_realise) }}
            />
          ) : (
            <Text style={s.note}>{t.aucunBudget}</Text>
          )}
        </Section>

        <Section s={s} titre={t.depenses}>
          <Text style={s.h3}>{t.parCategorie}</Text>
          <Tableau
            s={s}
            langue={langue}
            colonnes={[
              { cle: "categorie", titre: t.categorie, largeur: "50%" },
              { cle: "nb", titre: t.nb, largeur: "12%", align: "right" },
              { cle: "montant", titre: t.montant, largeur: "24%", align: "right" },
              { cle: "part", titre: t.part, largeur: "14%", align: "right" },
            ]}
            lignes={d.depenses_par_categorie.categories.map((c) => ({ categorie: c.categorie, nb: c.nb, montant: mad(c.montant), part: formatPourcent(c.part) }))}
            total={{ categorie: t.total, nb: d.depenses_par_categorie.nb, montant: mad(d.depenses_par_categorie.total), part: "" }}
          />
          <Text style={s.h3}>{t.listeDepenses}</Text>
          <Tableau
            s={s}
            langue={langue}
            colonnes={[
              { cle: "date", titre: t.date, largeur: "13%" },
              { cle: "libelle", titre: t.libelle, largeur: "35%" },
              { cle: "categorie", titre: t.categorie, largeur: "18%" },
              { cle: "prestataire", titre: t.prestataire, largeur: "18%" },
              { cle: "montant", titre: t.montant, largeur: "16%", align: "right" },
            ]}
            lignes={depenses.map((x) => ({ date: formatDate(x.date, langue), libelle: x.libelle, categorie: x.categorie, prestataire: x.prestataire, montant: mad(x.montant_ttc) }))}
          />
          {d.depenses.length > MAX_DEPENSES ? <Text style={s.note}>{t.suite.replace("{{n}}", String(d.depenses.length - MAX_DEPENSES))}</Text> : null}
        </Section>

        <Section s={s} titre={t.impayes}>
          <Text style={s.h3}>{t.anciennete}</Text>
          <Tableau
            s={s}
            langue={langue}
            colonnes={[
              { cle: "tranche", titre: t.tranche, largeur: "40%" },
              { cle: "lignes", titre: t.lignes, largeur: "15%", align: "right" },
              { cle: "lots", titre: t.lots, largeur: "15%", align: "right" },
              { cle: "montant", titre: t.montant, largeur: "30%", align: "right" },
            ]}
            lignes={d.impayes.tranches.map((tr) => ({ tranche: t.tranches[tr.tranche] ?? tr.tranche, lignes: tr.nb_lignes, lots: tr.nb_lots, montant: mad(tr.montant) }))}
            total={{ tranche: t.total, lignes: d.impayes.nb_lignes, lots: d.impayes.nb_lots_en_retard, montant: mad(d.impayes.total) }}
          />
          {variante === "complete" ? (
            <View>
              <Text style={s.h3}>{t.parLot}</Text>
              <Tableau
                s={s}
                langue={langue}
                colonnes={[
                  { cle: "lot", titre: t.lot, largeur: "25%" },
                  { cle: "lignes", titre: t.lignes, largeur: "15%", align: "right" },
                  { cle: "retard", titre: t.retardMax, largeur: "20%", align: "right" },
                  { cle: "conteste", titre: t.conteste, largeur: "15%", align: "center" },
                  { cle: "reste", titre: t.resteDu, largeur: "25%", align: "right" },
                ]}
                lignes={d.impayes.par_lot.map((l) => ({ lot: l.lot_numero, lignes: l.nb_lignes, retard: l.retard_max_jours, conteste: l.conteste ? t.oui : t.non, reste: mad(l.reste_du) }))}
              />
            </View>
          ) : null}
        </Section>

        <Section s={s} titre={t.reserve}>
          <Kv s={s} label={t.reserveOuverture} valeur={d.tresorerie.reserve_configuree ? mad(d.reserve.solde_ouverture) : t.reserveNonConfiguree} />
          <Kv s={s} label={t.reserveCloture} valeur={d.tresorerie.reserve_configuree ? mad(d.reserve.solde_cloture) : t.reserveNonConfiguree} />
          {d.reserve.mouvements.length > 0 ? (
            <Tableau
              s={s}
              langue={langue}
              colonnes={[
                { cle: "date", titre: t.date, largeur: "15%" },
                { cle: "type", titre: t.type, largeur: "20%" },
                { cle: "libelle", titre: t.libelle, largeur: "45%" },
                { cle: "montant", titre: t.montant, largeur: "20%", align: "right" },
              ]}
              lignes={d.reserve.mouvements.map((m) => ({ date: formatDate(m.date, langue), type: m.type, libelle: m.description, montant: mad(m.montant) }))}
            />
          ) : (
            <Text style={s.note}>{t.aucunMouvement}</Text>
          )}
        </Section>

        <Section s={s} titre={t.faits}>
          <Kv s={s} label={t.incidents} valeur={String(d.faits_marquants.nb_incidents)} />
          <Text style={s.h3}>{t.incidentsMajeurs}</Text>
          {d.faits_marquants.incidents_majeurs.length === 0 ? <Text style={s.note}>{t.aucun}</Text> : d.faits_marquants.incidents_majeurs.map((i) => <Text key={i.id} style={[s.texte, { fontSize: 8.5, marginBottom: 2 }]}>• {formatDate(i.date, langue)} — {i.categorie} / {i.sous_categorie} ({i.statut})</Text>)}
          <Text style={s.h3}>{t.agTenues}</Text>
          {d.faits_marquants.ag_tenues.length === 0 ? <Text style={s.note}>{t.aucun}</Text> : d.faits_marquants.ag_tenues.map((a) => <Text key={a.id} style={[s.texte, { fontSize: 8.5, marginBottom: 2 }]}>• {formatDate(a.date, langue)} — {a.type} — {a.nb_resolutions} {t.resolutions}{a.quorum_atteint ? ` — ${t.quorum} ${a.quorum_atteint}` : ""}</Text>)}
          <Text style={s.h3}>{t.contratsSignes}</Text>
          {d.faits_marquants.contrats_signes.length === 0 ? <Text style={s.note}>{t.aucun}</Text> : d.faits_marquants.contrats_signes.map((c) => <Text key={c.id} style={[s.texte, { fontSize: 8.5, marginBottom: 2 }]}>• {formatDate(c.date, langue)} — {c.libelle} ({c.type})</Text>)}
        </Section>

        <Section s={s} titre={t.signatures}>
          <Text style={s.note}>{t.mentionApprobation}</Text>
          <View style={s.signatures}>
            <View style={s.signature}>
              <Text>{t.signatureSyndic}</Text>
              <Text style={{ color: "#555" }}>{d.syndic.nom ?? " "}</Text>
            </View>
            <View style={s.signature}>
              <Text>{t.signaturePresident}</Text>
              <Text style={{ color: "#555" }}>{d.president_conseil.nom ?? " "}</Text>
            </View>
          </View>
        </Section>

        <Text style={s.pied} fixed>{t.pied}</Text>
      </Page>
    </Document>
  );
}

export async function genererRapportGestionPdf(d: RapportGestionDonnees, langue: LanguePdf, variante: VariantePdf, logo?: { data: Buffer; format: "png" | "jpg" }): Promise<Buffer> {
  enregistrerPolices();
  return renderToBuffer(<RapportDocument d={d} langue={langue} variante={variante} logo={logo} />);
}
