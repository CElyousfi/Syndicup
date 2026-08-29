/**
 * Génération du PDF de quittance — Doc A §3.4 (« quittance générée automatiquement au paiement
 * complet », valeur fiscale, conservation 10 ans). Le PDF est un RENDU des lignes immuables
 * `quittance` + `paiement` : généré à la demande (déterministe), jamais stocké comme source de
 * vérité. Rendu FR (même chantier AR que le PV — ROADMAP M9).
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export interface QuittancePdfDonnees {
  numero: string;
  coproprieteNom: string;
  coproprieteAdresse: string;
  lotNumero: string;
  lotType: string;
  periode: string;
  typeAppel: string;
  montant: string; // décimal API, ex. "1200.00"
  dateEmission: string; // ISO
  paiements: { montant: string; methode: string; horodatage: string }[];
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", color: "#111" },
  entete: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: "1 solid #ddd",
    paddingBottom: 16,
    marginBottom: 24,
  },
  marque: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  titre: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "right" },
  numero: { fontSize: 10, color: "#555", textAlign: "right", marginTop: 2 },
  corps: { marginBottom: 20, lineHeight: 1.5 },
  ligneMeta: { flexDirection: "row", marginBottom: 5 },
  metaLabel: { width: 170, fontFamily: "Helvetica-Bold" },
  montant: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  tableEntete: {
    flexDirection: "row",
    borderBottom: "1 solid #999",
    paddingBottom: 4,
    marginTop: 16,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#555",
  },
  tableLigne: { flexDirection: "row", paddingVertical: 4, borderBottom: "0.5 solid #eee" },
  colDate: { width: "40%" },
  colMethode: { width: "30%" },
  colMontant: { width: "30%", textAlign: "right" },
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

function formatMad(v: string): string {
  const [entier = "0", dec = ""] = v.split(".");
  return `${entier.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${(dec + "00").slice(0, 2)} MAD`;
}

function QuittanceDocument({ donnees }: { donnees: QuittancePdfDonnees }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.entete}>
          <View>
            <Text style={styles.marque}>SyndicUp</Text>
            <Text style={{ fontSize: 9, color: "#555", marginTop: 2 }}>
              {donnees.coproprieteNom}
            </Text>
            <Text style={{ fontSize: 9, color: "#555" }}>{donnees.coproprieteAdresse}</Text>
          </View>
          <View>
            <Text style={styles.titre}>Quittance de paiement</Text>
            <Text style={styles.numero}>{donnees.numero}</Text>
          </View>
        </View>

        <Text style={styles.corps}>
          Le syndic de la copropriété « {donnees.coproprieteNom} » reconnaît avoir reçu le
          paiement intégral de la ligne d'appel de fonds ci-dessous.
        </Text>

        <View>
          <View style={styles.ligneMeta}>
            <Text style={styles.metaLabel}>Lot</Text>
            <Text>
              {donnees.lotType} {donnees.lotNumero}
            </Text>
          </View>
          <View style={styles.ligneMeta}>
            <Text style={styles.metaLabel}>Période</Text>
            <Text>{donnees.periode}</Text>
          </View>
          <View style={styles.ligneMeta}>
            <Text style={styles.metaLabel}>Type d'appel</Text>
            <Text>{donnees.typeAppel}</Text>
          </View>
          <View style={styles.ligneMeta}>
            <Text style={styles.metaLabel}>Montant acquitté</Text>
            <Text style={styles.montant}>{formatMad(donnees.montant)}</Text>
          </View>
          <View style={styles.ligneMeta}>
            <Text style={styles.metaLabel}>Date d'émission</Text>
            <Text>{new Date(donnees.dateEmission).toLocaleDateString("fr-FR")}</Text>
          </View>
        </View>

        {donnees.paiements.length > 0 ? (
          <View>
            <View style={styles.tableEntete}>
              <Text style={styles.colDate}>DATE</Text>
              <Text style={styles.colMethode}>MÉTHODE</Text>
              <Text style={styles.colMontant}>MONTANT</Text>
            </View>
            {donnees.paiements.map((p, i) => (
              <View key={i} style={styles.tableLigne}>
                <Text style={styles.colDate}>
                  {new Date(p.horodatage).toLocaleString("fr-FR")}
                </Text>
                <Text style={styles.colMethode}>{p.methode}</Text>
                <Text style={styles.colMontant}>{formatMad(p.montant)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.pied} fixed>
          Document à valeur fiscale — à conserver 10 ans. Quittance {donnees.numero} générée par
          SyndicUp le {new Date(donnees.dateEmission).toLocaleDateString("fr-FR")}.
        </Text>
      </Page>
    </Document>
  );
}

export async function genererQuittancePdfBuffer(donnees: QuittancePdfDonnees): Promise<Buffer> {
  return renderToBuffer(<QuittanceDocument donnees={donnees} />);
}
