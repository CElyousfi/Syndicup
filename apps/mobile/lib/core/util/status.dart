/// Mapping enum métier → variante de badge (brief §6) — la même couleur raconte toujours la
/// même chose, sur web comme sur mobile (apps/web/lib/status.ts).
enum BadgeVariant { neutral, ok, warn, danger, info, outline, ink }

const Map<String, BadgeVariant> ligneAppelVariant = {'PAYE': BadgeVariant.ok, 'PARTIEL': BadgeVariant.warn, 'IMPAYE': BadgeVariant.danger};
BadgeVariant escaladeVariant(String niveau) => niveau == 'N0' ? BadgeVariant.neutral : BadgeVariant.ink;
const Map<String, BadgeVariant> budgetVariant = {'PROPOSE': BadgeVariant.neutral, 'VOTE': BadgeVariant.info, 'ACTIF': BadgeVariant.ok, 'REMPLACE': BadgeVariant.outline};
const Map<String, BadgeVariant> appelVariant = {'BROUILLON': BadgeVariant.neutral, 'EMIS': BadgeVariant.info, 'CLOTURE': BadgeVariant.outline};
const Map<String, BadgeVariant> agVariant = {'PLANIFIEE': BadgeVariant.neutral, 'CONVOQUEE': BadgeVariant.info, 'EN_COURS': BadgeVariant.warn, 'CLOTUREE': BadgeVariant.ok, 'ANNULEE': BadgeVariant.outline};
const Map<String, BadgeVariant> resolutionVariant = {'EN_ATTENTE': BadgeVariant.neutral, 'ADOPTEE': BadgeVariant.ok, 'REJETEE': BadgeVariant.danger};
const Map<String, BadgeVariant> incidentVariant = {'OUVERT': BadgeVariant.danger, 'EN_COURS': BadgeVariant.warn, 'RESOLU': BadgeVariant.ok, 'FERME': BadgeVariant.outline};
const Map<String, BadgeVariant> urgenceVariant = {'NORMALE': BadgeVariant.neutral, 'URGENTE': BadgeVariant.warn, 'URGENCE_MAXIMALE': BadgeVariant.danger};
const Map<String, BadgeVariant> reservationVariant = {'EN_ATTENTE': BadgeVariant.neutral, 'CONFIRMEE': BadgeVariant.ok, 'REJETEE': BadgeVariant.danger, 'ANNULEE': BadgeVariant.outline};
const Map<String, BadgeVariant> visiteVariant = {'EN_ATTENTE': BadgeVariant.warn, 'AUTORISE': BadgeVariant.ok, 'REFUSE': BadgeVariant.danger};
const Map<String, BadgeVariant> personnelVariant = {'PRESENT': BadgeVariant.ok, 'ABSENT': BadgeVariant.danger, 'REMPLACE': BadgeVariant.warn};
const Map<String, BadgeVariant> litigeVariant = {'OUVERT': BadgeVariant.danger, 'RESOLU': BadgeVariant.ok, 'CLOS': BadgeVariant.outline};
const Map<String, BadgeVariant> invitationVariant = {'EN_ATTENTE': BadgeVariant.info, 'ACCEPTEE': BadgeVariant.ok, 'EXPIREE': BadgeVariant.outline, 'REGENEREE': BadgeVariant.neutral};
const Map<String, BadgeVariant> compteVariant = {'INVITE': BadgeVariant.neutral, 'EN_VALIDATION': BadgeVariant.warn, 'ACTIF': BadgeVariant.ok, 'SUSPENDU': BadgeVariant.danger, 'DESACTIVE': BadgeVariant.outline, 'ANONYMISE': BadgeVariant.ink};
const Map<String, BadgeVariant> contestationVariant = {'OUVERTE': BadgeVariant.warn, 'REPONDUE': BadgeVariant.ok, 'MEDIEE': BadgeVariant.info, 'TRIBUNAL': BadgeVariant.ink};
const Map<String, BadgeVariant> lotVariant = {'OCCUPE': BadgeVariant.ok, 'VACANT': BadgeVariant.neutral, 'ORPHELIN': BadgeVariant.warn, 'EN_SUCCESSION': BadgeVariant.outline, 'SINISTRE': BadgeVariant.danger, 'TANTIEME_A_REGULARISER': BadgeVariant.warn};
const Map<String, BadgeVariant> envoiVariant = {'EN_ATTENTE': BadgeVariant.neutral, 'ENVOYE': BadgeVariant.ok, 'ECHOUE': BadgeVariant.danger};
const Map<String, BadgeVariant> coproVariant = {'ACTIVE': BadgeVariant.ok, 'ARCHIVEE': BadgeVariant.outline};
const Map<String, BadgeVariant> regimeLcdVariant = {'NON_DEFINI': BadgeVariant.neutral, 'AUTORISEE': BadgeVariant.ok, 'ENCADREE': BadgeVariant.info, 'INTERDITE': BadgeVariant.danger};
const Map<String, BadgeVariant> declarationLcdVariant = {'EN_ATTENTE': BadgeVariant.warn, 'VALIDEE': BadgeVariant.ok, 'REFUSEE': BadgeVariant.danger, 'SUSPENDUE': BadgeVariant.ink, 'CLOTUREE': BadgeVariant.outline};
const Map<String, BadgeVariant> sejourVariant = {'PREVU': BadgeVariant.info, 'EN_COURS': BadgeVariant.ok, 'TERMINE': BadgeVariant.outline, 'ANNULE': BadgeVariant.neutral};
// M16 — dépenses et factures (même palette que apps/web/lib/status.ts).
const Map<String, BadgeVariant> depenseVariant = {'BROUILLON': BadgeVariant.outline, 'A_APPROUVER': BadgeVariant.warn, 'APPROUVEE': BadgeVariant.info, 'REJETEE': BadgeVariant.danger, 'PAYEE': BadgeVariant.ok, 'ANNULEE': BadgeVariant.neutral};
const Map<String, BadgeVariant> factureVariant = {'RECUE': BadgeVariant.neutral, 'VERIFIEE': BadgeVariant.info, 'CONTESTEE': BadgeVariant.danger, 'REGLEE': BadgeVariant.ok};
const Map<String, BadgeVariant> justificatifVariant = {'EN_ATTENTE': BadgeVariant.warn, 'VALIDE': BadgeVariant.ok, 'REJETE': BadgeVariant.danger, 'ANNULE': BadgeVariant.neutral};

// M18 — rapports de gestion, ancienneté des impayés.
const Map<String, BadgeVariant> rapportVariant = {'BROUILLON': BadgeVariant.outline, 'GENERE': BadgeVariant.info, 'SOUMIS_AG': BadgeVariant.warn, 'APPROUVE': BadgeVariant.ok, 'REJETE': BadgeVariant.danger};
const Map<String, BadgeVariant> trancheVariant = {'0_30': BadgeVariant.info, '31_90': BadgeVariant.warn, '91_180': BadgeVariant.danger, 'PLUS_180': BadgeVariant.danger};
