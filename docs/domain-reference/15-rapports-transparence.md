# Rapports, rapport de gestion annuel, exports, transparence — « rendre les comptes »

> Domaine dérivé de Doc A §8 (obligations du syndic : reddition des comptes), §6 (approbation des
> comptes en assemblée générale), §3.5 (transparence : le résident doit savoir où va son argent) et
> §11 (« état daté » remis au notaire à la vente). Doc A ne fixe ni le contenu du rapport de
> gestion ni la forme des exports : ce fichier les fixe pour le module M18 — il ne réécrit pas
> Doc A. La majorité requise pour l'approbation des comptes est PROVISOIRE (brief §9).

---

## 15.0 — Principes

| Principe | Règle | Gestion plateforme |
| --- | --- | --- |
| Un seul moteur de chiffres | Tableau de bord, grand livre, transparence et rapport de gestion lisent les MÊMES écritures immuables (paiements VALIDE, dépenses PAYEE, mouvements du fonds de réserve). | `apps/api/lib/rapports/chiffres.ts` + `grand-livre.ts` ; le rapport est réconcilié avec le grand livre par test (`tests/rapports.test.ts`). |
| Aucune API bancaire | Le compte courant est une ESTIMATION : Σ paiements validés − Σ dépenses payées (compte courant). | Affiché avec la mention « le solde réel se lit sur le relevé » ; la réserve est le solde du ledger `fonds_reserve_mouvement`. |
| Le rapport est figé | Le rapport remis à l'AG doit être reproductible et auditable. | `rapport_gestion.donnees_json` = instantané de TOUS les chiffres (chaînes décimales) ; le PDF est un rendu de cet instantané, jamais un recalcul. |
| La transparence n'expose jamais un lot | Doc A §12.3 : un résident ne voit pas la situation des autres lots. | `GET /rapports/transparence` : agrégats de niveau copropriété (sommes, comptes, taux) via une fonction SECURITY DEFINER qui ne renvoie aucune ligne ; test négatif explicite LOCATAIRE / PROPRIETAIRE. |
| Toute extraction est tracée | CNDP : qui a extrait quelles données personnelles, quand. | Table APPEND-ONLY `export_log` (type, filtres, nb lignes, format) écrite par chaque export csv / xlsx / PDF, y compris le relevé d'un propriétaire. |
| Le conseil lit, le syndic rend les comptes | Doc A §8. | `rapports.syndic.lire` = syndic + conseil ; `rapports.gestion.gerer` (générer, soumettre, factures visibles) = syndic seul ; `exports.proprietaires` (nominatif) = syndic seul. |

## 15.1 — Tableau de bord (`GET /rapports/tableau-de-bord`)

| Indicateur | Calcul | Source |
| --- | --- | --- |
| Compte courant estimé | Σ `paiement` VALIDE (horodatage) − Σ `depense` PAYEE `COMPTE_COURANT` (`paye_le`, repli `date_depense`) | tous exercices |
| Série 12 mois | mêmes règles par mois, solde cumulé depuis le solde d'ouverture | mois courant inclus |
| Réserve | Σ `fonds_reserve_mouvement.montant` | ledger M5/M16 |
| Recouvrement | Σ `montant_paye` / Σ `montant_du` des lignes d'appel non BROUILLON de l'exercice (période « YYYY-MM ») ; idem pour le mois courant | `appel_de_fonds_lot` |
| Impayés par ancienneté | lignes IMPAYE / PARTIEL échues ; tranches 0–30, 31–90, 91–180, > 180 jours ; top 5 lots (syndic / conseil uniquement) | `appel_de_fonds_lot` |
| Dépenses par catégorie | PAYEE de l'exercice, et du mois | `depense` |
| Budget vs réalisé | `calculerBudgetVsRealise` (M16) | `budget_poste` |
| Incidents ouverts par urgence, justificatifs EN_ATTENTE (M17), contrats (M19 — `null` tant que non livré) | | |

## 15.2 — Grand livre (`GET /rapports/grand-livre?exercice=`)

Journal chronologique : `ENTREE` (paiement), `SORTIE` (dépense payée — compte courant ou réserve
selon `source`), `RESERVE` (mouvement du fonds sans dépense liée : cotisation…). Les décaissements
de réserve liés à une dépense ne sont pas doublés (portés par la ligne SORTIE). Deux soldes
courants (compte courant estimé, réserve) partent des soldes d'ouverture au 1er janvier.
`format=csv|xlsx` = export journalisé.

## 15.3 — Rapport de gestion annuel

| Statut | Sens | Transition |
| --- | --- | --- |
| `BROUILLON` | Instantané figé, PDF non produit (échec de rendu / stockage). | `POST /rapports/gestion` (régénérable) |
| `GENERE` | Instantané + PDF publique FR déposé en Document `RAPPORT_GESTION` (visibilité CONSEIL_SYNDICAL). | régénération possible tant que non soumis |
| `SOUMIS_AG` | Lié à une AG PLANIFIEE / CONVOQUEE ; résolution « Approbation des comptes de l'exercice N » créée par le service AG (`creerResolutionDb`) ; Document rendu PUBLIC_COPROPRIETE ; notification `RAPPORT_GESTION_DISPONIBLE` aux copropriétaires et au conseil. | `POST /rapports/gestion/{id}/soumettre-ag` |
| `APPROUVE` / `REJETE` | Résultat de la résolution à sa finalisation (hook `ag.ts::finaliserResolution` → `finaliserRapportsLies`). Un rapport REJETE libère l'exercice (nouveau rapport possible). | automatique |

Contenu de l'instantané (`donnees_json`, version 1) : copropriété (logo), syndic, président du
conseil (premier rôle CONSEIL_SYNDICAL actif), trésorerie (ouverture / totaux / clôture =
grand livre), recouvrement, impayés (tranches + par lot), budget vs réalisé, dépenses payées,
répartition par catégorie, mouvements de réserve, faits marquants (incidents URGENCE_MAXIMALE,
AG clôturées, contrats signés — M19), justificatifs en attente, indicateur « seuil non configuré ».

PDF (`GET /rapports/gestion/{id}/pdf?langue=fr|ar&variante=publique|complete`) : react-pdf, Noto
Sans Arabic + bidi pour l'arabe, bloc de signatures syndic / président du conseil ; la variante
`complete` (impayés nominatifs par lot) est réservée au syndic et au conseil ; chaque rendu est
journalisé (`RAPPORT_GESTION_PDF`).

## 15.4 — Transparence (`GET /rapports/transparence`)

Tout membre, locataires compris. Renvoie : trésorerie (estimation + réserve), taux de
recouvrement, impayés (total + NOMBRE de lots en retard), budget vs réalisé par poste (prévu /
réalisé), dépenses PAYEE paginées (libellé, catégorie, montant, date, prestataire), rapports de
gestion publiés (documents PUBLIC_COPROPRIETE). Les factures des dépenses ne sont exposées que si
`copropriete.factures_visibles_residents` est vrai (`PATCH /coproprietes/{id}/transparence`,
syndic, audité) — lecture via `transparence_factures` (SECURITY DEFINER, bornée à la copropriété,
aux dépenses PAYEE et à l'option). La policy RLS `facture` n'est pas assouplie.

## 15.5 — Relevé de charges par lot (« état daté », Doc A §11)

`GET /finances/lots/{id}/releve[/pdf]?exercice=&langue=` : appels de l'exercice (dû / payé /
statut / échéance / contestation), paiements, déclarations en attente (M17), solde de l'exercice et
solde total dû. Syndic / conseil pour tout lot ; propriétaire (indivisaire, représentant) pour ses
lots (`exports.releve_lot` = scoped + RLS) ; le locataire n'y a pas droit. Journalisé `RELEVE_LOT`.

## 15.6 — Exports (`format=csv|xlsx`)

| Ressource | Endpoint | Qui | Journal |
| --- | --- | --- | --- |
| Lots | `GET /lots` | syndic, conseil | `LOTS` |
| Propriétaires (nominatif) | `GET /rapports/proprietaires` (format obligatoire) | syndic | `PROPRIETAIRES` |
| Impayés | `GET /rapports/impayes` | syndic, conseil | `IMPAYES` |
| Paiements | `GET /finances/paiements` | syndic, conseil | `PAIEMENTS` |
| Dépenses | `GET /depenses` (M16) | syndic, conseil | `DEPENSES` |
| Grand livre | `GET /rapports/grand-livre` | syndic, conseil | `GRAND_LIVRE` |
| Incidents | `GET /incidents` | syndic, conseil | `INCIDENTS` |
| Contrats, personnel, parkings | M19, M20, M23 | | |

Encodeur unique `apps/api/lib/http/export.ts` : CSV UTF-8 + BOM, « ; », neutralisation des
formules ; XLSX via `exceljs` (cellules texte — jamais un montant converti en float par le tableur).
`GET /rapports/exports` = journal (syndic / conseil).

## 15.7 — Hors périmètre / à confirmer

- Rapprochement bancaire automatique (import du relevé) : décision projet « aucune API bancaire » ;
  le grand livre est prêt pour un import CSV ultérieur.
- Majorité requise pour l'approbation des comptes : `config_json.majorite_approbation_comptes`
  ou `type_majorite` fourni à la soumission — sinon 422 `RAPPORT_PARAMETRE_NON_CONFIGURE` (brief §9).
- Version arabe du PDF : rendu bidi react-pdf ≥ 4 avec Noto Sans Arabic — à faire relire par un
  locuteur avant impression officielle.
