/**
 * Génération du PDF de procès-verbal d'AG — M6 (Master Spec Partie 8.6, Doc A §12.1 "PV = preuve
 * légale des décisions AG. Plateforme génère PV automatiquement. Horodatage.").
 *
 * Le PDF est un RENDU du `ag_pv.contenu_json` (la source de vérité juridique reste la ligne
 * `ag_pv` : contenu_json + hash_integrite SHA-256, append-only) — le hash est imprimé en pied de
 * page pour permettre la vérification d'intégrité du document imprimé contre la base.
 *
 * ⚠️ Rendu FR uniquement pour l'instant — la version AR (RTL + police arabe embarquée) suit le
 * même chantier que les templates de notification FR/AR (ROADMAP_BACKLOG.md M9, non livré).
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export interface PvPdfDonnees {
  coproprieteNom: string;
  agId: string;
  type: string;
  dateAg: string; // ISO
  quorumRequis: string | null;
  quorumAtteint: string | null;
  resolutions: {
    ordre: number;
    texte: string;
    typeMajorite: string;
    resultat: string;
  }[];
  hashIntegrite: string;
  horodatageGeneration: string; // ISO
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", color: "#111" },
  titre: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  sousTitre: { fontSize: 12, color: "#444", marginBottom: 24 },
  section: { marginBottom: 16 },
  ligneMeta: { flexDirection: "row", marginBottom: 4 },
  metaLabel: { width: 160, fontFamily: "Helvetica-Bold" },
  resolution: { marginBottom: 10, paddingBottom: 8, borderBottom: "1 solid #ddd" },
  resolutionTitre: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
  resultat: { fontFamily: "Helvetica-Bold" },
  pied: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 7,
    color: "#666",
    textAlign: "center",
  },
});

function PvDocument({ donnees }: { donnees: PvPdfDonnees }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.titre}>Procès-verbal d'Assemblée Générale</Text>
        <Text style={styles.sousTitre}>{donnees.coproprieteNom}</Text>

        <View style={styles.section}>
          <View style={styles.ligneMeta}>
            <Text style={styles.metaLabel}>Type d'assemblée</Text>
            <Text>{donnees.type}</Text>
          </View>
          <View style={styles.ligneMeta}>
            <Text style={styles.metaLabel}>Date de l'AG</Text>
            <Text>{new Date(donnees.dateAg).toLocaleString("fr-FR")}</Text>
          </View>
          <View style={styles.ligneMeta}>
            <Text style={styles.metaLabel}>Quorum requis</Text>
            <Text>{donnees.quorumRequis ?? "Non défini"}</Text>
          </View>
          <View style={styles.ligneMeta}>
            <Text style={styles.metaLabel}>Quorum atteint</Text>
            <Text>{donnees.quorumAtteint ?? "Non calculable"}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.resolutionTitre, { fontSize: 13, marginBottom: 8 }]}>
            Résolutions ({donnees.resolutions.length})
          </Text>
          {donnees.resolutions.map((r) => (
            <View key={r.ordre} style={styles.resolution} wrap={false}>
              <Text style={styles.resolutionTitre}>
                Résolution n°{r.ordre} — majorité {r.typeMajorite}
              </Text>
              <Text>{r.texte}</Text>
              <Text style={styles.resultat}>Résultat : {r.resultat}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.pied} fixed>
          PV généré le {new Date(donnees.horodatageGeneration).toLocaleString("fr-FR")} — AG{" "}
          {donnees.agId} — Empreinte d'intégrité SHA-256 : {donnees.hashIntegrite}
        </Text>
      </Page>
    </Document>
  );
}

/** Rendu du PDF en mémoire — l'appelant (cloturerAg) téléverse le buffer vers Supabase Storage. */
export async function genererPvPdfBuffer(donnees: PvPdfDonnees): Promise<Buffer> {
  return renderToBuffer(<PvDocument donnees={donnees} />);
}
