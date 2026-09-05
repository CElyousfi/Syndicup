# Dépenses, factures, fournisseurs, postes budgétaires — « l'argent qui sort »

> Domaine dérivé de Doc A §3 (charges : §3.5 postes de charge, §3.6 fonds de réserve, §3.7
> dépassement du budget), §8 (obligations du syndic : §8.3 « toute dépense > seuil configurable
> doit être liée à une résolution AG ou classée comme urgence », « 3 devis obligatoires au-delà d'un
> seuil ») et §6 (approbation des comptes en AG). Doc A ne détaille pas le cycle de vie d'une
> dépense : ce fichier le fixe pour le module M16 — il ne réécrit pas Doc A. Les valeurs à
> caractère légal ou fiscal (seuil d'approbation, TVA, décaissement de réserve sans résolution)
> sont PROVISOIRES et tracées dans `docs/LEGAL_QUESTIONS_BRIEF.md` §8.

---

## 14.0 — Principes

| Principe | Règle | Gestion plateforme |
| --- | --- | --- |
| Miroir de l'argent qui entre | Une dépense est à la copropriété ce qu'un appel de fonds est à un lot : cycle de vie, paiement, preuve, mêmes rapports (M18). | Table `depense` + journal append-only `depense_log` ; jamais une seconde façon d'enregistrer un mouvement d'argent. |
| Un seul grand livre de la réserve | Doc A §3.6 : la réserve est un compte séparé, décaissé sur décision AG. | Payer une dépense `FONDS_RESERVE` insère un mouvement `DEPENSE` (négatif) dans `fonds_reserve_mouvement`, même transaction que le passage en PAYEE, lié par `depense_id` ; le solde ne peut jamais devenir négatif (422 `FONDS_RESERVE_INSUFFISANT` + trigger). |
| Aucune API bancaire | Les banques marocaines n'exposent rien d'exploitable. | Le syndic saisit méthode + référence exactement comme sur le relevé et joint la preuve (reçu de virement, photo du chèque) : `Document` de type `JUSTIFICATIF_DEPENSE`. Rapprochement manuel. |
| Le conseil contrôle, il ne paie pas | Doc A §8 : le syndic paie, le conseil syndical approuve au-dessus d'un seuil. | `depenses.gerer` = syndic ; `depenses.approuver` = conseil au-dessus du seuil, syndic en dessous. Un résident ne lit que les dépenses PAYEE (transparence, exposée par M18). |
| Rien n'est deviné | Seuil d'approbation, TVA, tolérance de réserve sans résolution = paramètres de copropriété nullables. | Seuil non configuré → toute dépense soumise passe par une approbation explicite du syndic et les rapports affichent « seuil non configuré ». |
| Le budget a des lignes | Doc A §10.2 « détail budget par poste visible dans l'app », §3.7 dépassement par poste. | `budget_poste` ; `budget_ag.montant_total = Σ montant_prevu` tenu par trigger, jamais édité directement quand des lignes existent (422 `BUDGET_TOTAL_DERIVE_DES_POSTES`). |

## 14.1 — Cycle de vie d'une dépense

| Statut | Sens | Qui | Effets |
| --- | --- | --- | --- |
| `BROUILLON` | Saisie en cours (facture reçue, devis…). | Syndic | Modifiable ; factures ajoutables. |
| `A_APPROUVER` | Soumise, décision attendue. | Syndic soumet | Notification `DEPENSE_A_APPROUVER` au conseil si le montant dépasse le seuil. |
| `APPROUVEE` | Bon à payer. | Conseil (au-dessus du seuil) / syndic (en dessous) — d'office à la soumission si seuil configuré et montant ≤ seuil | Notification `DEPENSE_APPROUVEE` au créateur ; compte dans « engagé ». |
| `REJETEE` | Refusée avec motif obligatoire. | Conseil / syndic | Notification `DEPENSE_REJETEE` ; modifiable puis re-soumise. |
| `PAYEE` | Payée (méthode, référence, date, preuve). | Syndic | Factures RECUE/VERIFIEE → REGLEE ; mouvement de réserve si `FONDS_RESERVE` ; compte dans « réalisé ». Ni modification ni annulation : correction = nouvelle dépense. |
| `ANNULEE` | Abandonnée (jamais depuis PAYEE). | Syndic | Reste visible au journal. |

Chaque transition écrit une ligne `depense_log` (`CREEE`, `SOUMISE`, `APPROUVEE`, `REJETEE`,
`PAYEE`, `ANNULEE`, `FACTURE_AJOUTEE`, `FACTURE_CONTESTEE`, `MODIFIEE`) et une entrée `audit_log`
`DEPENSE_*`. Toute transition est idempotente (`Idempotency-Key`).

## 14.2 — Routage de l'approbation (Doc A §8.3)

| Configuration | Montant | Soumission | Décision |
| --- | --- | --- | --- |
| `seuil_approbation_conseil` NULL | tout | `A_APPROUVER` | Syndic (approbation explicite) ; rapports : « seuil non configuré ». |
| Seuil configuré | ≤ seuil | `APPROUVEE` d'office si l'acteur est le syndic | — |
| Seuil configuré | > seuil | `A_APPROUVER` + notification conseil | Conseil syndical seul (syndic → 422 `DEPENSE_APPROBATION_CONSEIL_REQUISE`). |

Le niveau requis (`SYNDIC` / `CONSEIL`) est renvoyé dans le détail pour que l'écran guide.

## 14.3 — Fonds de réserve (Doc A §3.6)

| Cas | Règle | Plateforme |
| --- | --- | --- |
| Dépense `FONDS_RESERVE` sans résolution | Décaissement lié à une décision AG « sauf urgence définie dans le règlement ». | 422 `DEPENSE_RESERVE_RESOLUTION_REQUISE` à la soumission et au paiement, sauf `reserve_sans_resolution_autorisee = true`. La résolution liée doit être `ADOPTEE`. |
| Solde insuffisant | Le fonds ne peut pas être à découvert. | 422 `FONDS_RESERVE_INSUFFISANT` ; trigger base `fonds_reserve_solde_non_negatif` pour la concurrence. |
| Signe des mouvements | Cotisation positive, dépense négative. | CHECK `fonds_reserve_mouvement_signe_check`. |

## 14.4 — Factures et fournisseurs

| Élément | Règle | Plateforme |
| --- | --- | --- |
| Facture | Plusieurs par dépense (acomptes) ; fichier = `Document` `FACTURE` (visibilité conseil). | `facture` : numéro, dates, montant TTC, statut `RECUE / VERIFIEE / CONTESTEE / REGLEE`. Échéance : rappel `FACTURE_ECHEANCE_PROCHE` au syndic J-7 (job quotidien, une seule fois). |
| Fiche fournisseur | ICE, RC, adresse, email, téléphone, RIB, notes. | `prestataire.*` ; `contact` (M7) conservé et recopié. RIB : 4 derniers caractères partout, lecture complète syndic seule via `GET /prestataires/{id}/rib`, auditée `PRESTATAIRE_RIB_CONSULTE`. |
| Évaluation | Doc A §8.3 « syndic favorise certains prestataires » → transparence. | Après RESOLU/FERME, le créateur du ticket ou le syndic note 1–5 (une fois) ; `prestataire.note_moyenne` recalculée (fonction SECURITY DEFINER — le résident ne lit pas l'annuaire). |
| Dépense depuis un incident | Doc A §5 : l'intervention coûte. | `POST /incidents/{id}/depense` : brouillon pré-rempli (prestataire assigné, catégorie mappée, libellé, description). Le détail de l'incident montre les dépenses liées et leur total (syndic/conseil). |

Correspondance catégorie d'incident → catégorie de dépense : PLOMBERIE / ELECTRICITE / ASCENSEUR /
EQUIPEMENTS_COLLECTIFS → REPARATIONS ; STRUCTURE → TRAVAUX ; NETTOYAGE / JARDINS / SECURITE /
PARKING → ENTRETIEN_COURANT ; NUISANCES → AUTRE ; ADMINISTRATIF → ADMINISTRATIF.

## 14.5 — Budget vs réalisé (base du tableau de bord M18)

Par poste du budget ACTIF de l'exercice : prévu, en attente (`A_APPROUVER`), engagé (`APPROUVEE`),
réalisé (`PAYEE`), consommé (= engagé + réalisé), écart, %, dépassement. Les dépenses sans poste
sont regroupées « hors poste » par catégorie. Totaux, solde de la réserve (Σ mouvements),
impayés (charges appelées non encaissées), indicateur « seuil non configuré », nombre à approuver.
Toute somme passe par `lib/money` ; les montants sortent en chaînes décimales.

## 14.6 — Exports

`GET /depenses?format=csv` : UTF-8 avec BOM, séparateur « ; », cellules échappées (formules
neutralisées), montants en chaînes décimales. Chaque export est journalisé (`audit_log`
`DEPENSES_EXPORTEES`, table `export_log` dédiée en M18) — CNDP : qui a extrait quoi, quand.

## 14.7 — Hors périmètre M16 (repris par les modules suivants ou à confirmer)

- Vue de transparence résident « où va mon argent » et rapport de gestion annuel (M18).
- Dépenses récurrentes issues de contrats (M19 — colonne `contrat_id` posée) et de la paie (M20 —
  `personnel_id`, `periode_paie`).
- Règle Doc A §8.3 « 3 devis obligatoires au-delà d'un seuil » : type de document `DEVIS` déclaré,
  comparatif non modélisé (à confirmer produit).
- Avance du syndic pour urgence (Doc A §3.6 `AVANCE_SYNDIC`) : non modélisée.
