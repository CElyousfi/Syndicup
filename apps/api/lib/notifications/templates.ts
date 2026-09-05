/**
 * Registre de templates FR/AR — Master Spec Partie 7.3 : chaque template existe en français ET
 * en arabe, le rendu suit `utilisateur.langue_preferee`. SMS volontairement courts (≤160 car.).
 * Interpolation `{{param}}` ; code inconnu = erreur explicite (jamais de fallback silencieux).
 *
 * ⚠️ Les chaînes AR sont une première passe machine — À FAIRE RELIRE par un locuteur natif
 * avant production (DoD FR/AR, CLAUDE.md §4).
 */

export interface TemplateRendu {
  titre: string;
  corps: string;
  langue: "FR" | "AR";
}

type Bloc = { titre: string; corps: string };
type Entree = { FR: Bloc; AR: Bloc };

export class TemplateInconnuError extends Error {}

const TEMPLATES: Record<string, Entree> = {
  AG_CONVOCATION: {
    FR: {
      titre: "Convocation à l'assemblée générale",
      corps:
        "Vous êtes convoqué(e) à l'assemblée générale de votre copropriété le {{date_ag}}. Consultez l'ordre du jour dans l'application.",
    },
    AR: {
      titre: "استدعاء إلى الجمع العام",
      corps:
        "أنتم مدعوون لحضور الجمع العام لملكيتكم المشتركة بتاريخ {{date_ag}}. اطلعوا على جدول الأعمال في التطبيق.",
    },
  },
  AG_RAPPEL: {
    FR: {
      titre: "Rappel — assemblée générale à venir",
      corps: "Rappel : l'assemblée générale de votre copropriété aura lieu le {{date_ag}}.",
    },
    AR: {
      titre: "تذكير — الجمع العام القادم",
      corps: "تذكير: سيُعقد الجمع العام لملكيتكم المشتركة بتاريخ {{date_ag}}.",
    },
  },
  PV_DISPONIBLE: {
    FR: {
      titre: "Procès-verbal d'AG disponible",
      corps: "Le procès-verbal de l'assemblée générale du {{date_ag}} est disponible dans vos documents.",
    },
    AR: {
      titre: "محضر الجمع العام متوفر",
      corps: "محضر الجمع العام المنعقد بتاريخ {{date_ag}} متوفر في وثائقكم.",
    },
  },
  APPEL_DE_FONDS_EMIS: {
    FR: {
      titre: "Nouvel appel de fonds",
      corps:
        "Un appel de fonds de {{montant}} MAD a été émis pour votre lot (échéance {{date_echeance}}). Détail dans l'application.",
    },
    AR: {
      titre: "دعوة جديدة لدفع المساهمات",
      corps:
        "صدرت دعوة لدفع مبلغ {{montant}} درهم عن حصتكم (آخر أجل {{date_echeance}}). التفاصيل في التطبيق.",
    },
  },
  INCIDENT_NOUVEAU: {
    FR: {
      titre: "Nouveau signalement",
      corps: "{{categorie}} — {{sous_categorie}}. Ouvrez l'incident pour le prendre en charge.",
    },
    AR: {
      titre: "بلاغ جديد",
      corps: "{{categorie}} — {{sous_categorie}}. افتحوا العطل للتكفل به.",
    },
  },
  RESERVATION_NOUVELLE: {
    FR: {
      titre: "Réservation à valider",
      corps: "{{espace}} demandé pour le {{date}}. Validez ou refusez dans l'application.",
    },
    AR: {
      titre: "حجز بانتظار الموافقة",
      corps: "طُلب {{espace}} ليوم {{date}}. وافقوا أو ارفضوا في التطبيق.",
    },
  },
  INCIDENT_URGENCE_MAXIMALE: {
    FR: {
      titre: "URGENCE dans votre résidence",
      corps: "Incident d'urgence maximale signalé : {{categorie}}. Suivez les consignes dans l'application.",
    },
    AR: {
      titre: "حالة طارئة في إقامتكم",
      corps: "تم الإبلاغ عن حادث بالغ الخطورة: {{categorie}}. اتبعوا التعليمات في التطبيق.",
    },
  },
  INCIDENT_STATUT_CHANGE: {
    FR: {
      titre: "Mise à jour de votre signalement",
      corps: "Votre incident « {{categorie}} » est passé au statut {{statut}}.",
    },
    AR: {
      titre: "تحديث حول بلاغكم",
      corps: "انتقل الحادث الذي أبلغتم عنه « {{categorie}} » إلى الحالة {{statut}}.",
    },
  },
  VISITE_NOUVELLE: {
    FR: {
      titre: "Visiteur en attente",
      corps: "{{visiteur_nom}} demande l'accès à votre lot. Autorisez ou refusez dans l'application.",
    },
    AR: {
      titre: "زائر في الانتظار",
      corps: "{{visiteur_nom}} يطلب الدخول إلى شقتكم. يمكنكم القبول أو الرفض عبر التطبيق.",
    },
  },
  // ── M15 — Location courte durée (Doc A §10.2) ──
  LCD_DECLARATION_A_VALIDER: {
    FR: {
      titre: "Déclaration de location courte durée à valider",
      corps: "Le lot {{lot}} demande à être exploité en location courte durée. Validez ou refusez dans l'application.",
    },
    AR: {
      titre: "تصريح كراء قصير المدة بانتظار المصادقة",
      corps: "الوحدة {{lot}} تطلب استغلالها في الكراء قصير المدة. صادقوا أو ارفضوا في التطبيق.",
    },
  },
  LCD_DECLARATION_DECISION: {
    FR: {
      titre: "Décision sur votre déclaration de location courte durée",
      corps: "Lot {{lot}} : déclaration {{decision}}. {{motif}}",
    },
    AR: {
      titre: "قرار بشأن تصريح الكراء قصير المدة",
      corps: "الوحدة {{lot}} : التصريح {{decision}}. {{motif}}",
    },
  },
  LCD_SEJOUR_DECLARE: {
    FR: {
      titre: "Nouveau séjour déclaré",
      corps: "Lot {{lot}} : {{nb_voyageurs}} voyageur(s) du {{date_arrivee}} au {{date_depart}}.",
    },
    AR: {
      titre: "تصريح بإقامة جديدة",
      corps: "الوحدة {{lot}} : {{nb_voyageurs}} مسافر(ين) من {{date_arrivee}} إلى {{date_depart}}.",
    },
  },
  LCD_SEJOUR_GARDIEN: {
    FR: {
      titre: "Voyageurs attendus",
      corps: "Lot {{lot}} : {{nb_voyageurs}} voyageur(s) attendu(s) le {{date_arrivee}} (départ le {{date_depart}}). Détails dans l'application.",
    },
    AR: {
      titre: "مسافرون منتظرون",
      corps: "الوحدة {{lot}} : {{nb_voyageurs}} مسافر(ين) منتظرون يوم {{date_arrivee}} (المغادرة يوم {{date_depart}}). التفاصيل في التطبيق.",
    },
  },
  LCD_SEJOUR_ANNULE: {
    FR: {
      titre: "Séjour annulé",
      corps: "Le séjour prévu le {{date_arrivee}} au lot {{lot}} est annulé.",
    },
    AR: {
      titre: "إلغاء إقامة",
      corps: "أُلغيت الإقامة المقررة يوم {{date_arrivee}} بالوحدة {{lot}}.",
    },
  },
  LCD_ARRIVEE_AUJOURDHUI: {
    FR: {
      titre: "Arrivée prévue aujourd'hui",
      corps: "Lot {{lot}} — {{nb_voyageurs}} voyageur(s) {{heure}}. Confirmez l'arrivée dans l'application.",
    },
    AR: {
      titre: "وصول مقرر اليوم",
      corps: "الوحدة {{lot}} — {{nb_voyageurs}} مسافر(ين) {{heure}}. أكّدوا الوصول في التطبيق.",
    },
  },
  VISITE_REPONSE: {
    FR: {
      titre: "Réponse du résident",
      corps: "La visite de {{visiteur_nom}} a été {{decision}}.",
    },
    AR: {
      titre: "رد الساكن",
      corps: "تمت معالجة زيارة {{visiteur_nom}} : {{decision}}.",
    },
  },
  LITIGE_ESCALADE: {
    FR: {
      titre: "Votre litige a été escaladé",
      corps: "Votre litige « {{type}} » passe au niveau {{niveau}}.",
    },
    AR: {
      titre: "تم تصعيد نزاعكم",
      corps: "انتقل النزاع « {{type}} » إلى المستوى {{niveau}}.",
    },
  },
  LITIGE_CLOTURE: {
    FR: {
      titre: "Votre litige est clôturé",
      corps: "Votre litige « {{type}} » a été clôturé (statut : {{statut}}).",
    },
    AR: {
      titre: "تم إغلاق نزاعكم",
      corps: "تم إغلاق النزاع « {{type}} » (الحالة: {{statut}}).",
    },
  },
  LITIGE_NOUVEAU: {
    FR: {
      titre: "Nouveau litige déclaré",
      corps: "Un résident a déclaré un litige : « {{type}} ». À examiner dans l'application.",
    },
    AR: {
      titre: "تصريح بنزاع جديد",
      corps: "صرّح أحد السكان بنزاع: « {{type}} ». يُرجى دراسته في التطبيق.",
    },
  },
  INCIDENT_ASSIGNE: {
    FR: {
      titre: "Nouveau ticket assigné",
      corps: "Un incident « {{categorie}} » ({{sous_categorie}}) vous a été assigné. Consultez-le dans l'application.",
    },
    AR: {
      titre: "تذكرة جديدة مسندة إليكم",
      corps: "أُسند إليكم عطب « {{categorie}} » ({{sous_categorie}}). اطلعوا عليه في التطبيق.",
    },
  },
  RESERVATION_VALIDEE: {
    FR: {
      titre: "Réservation confirmée",
      corps: "Votre réservation de « {{espace}} » le {{date}} est confirmée.",
    },
    AR: {
      titre: "تم تأكيد الحجز",
      corps: "تم تأكيد حجزكم لـ « {{espace}} » بتاريخ {{date}}.",
    },
  },
  RESERVATION_REJETEE: {
    FR: {
      titre: "Réservation refusée",
      corps: "Votre réservation de « {{espace}} » le {{date}} a été refusée : {{motif}}",
    },
    AR: {
      titre: "تم رفض الحجز",
      corps: "رُفض حجزكم لـ « {{espace}} » بتاريخ {{date}}: {{motif}}",
    },
  },
  RESERVATION_ANNULEE: {
    FR: {
      titre: "Réservation annulée",
      corps: "Une réservation de « {{espace}} » le {{date}} a été annulée par le résident.",
    },
    AR: {
      titre: "تم إلغاء حجز",
      corps: "ألغى الساكن حجز « {{espace}} » بتاريخ {{date}}.",
    },
  },
  CONTESTATION_NOUVELLE: {
    FR: {
      titre: "Nouvelle contestation de charges",
      corps: "Un résident conteste une ligne de charges : « {{motif}} ». Réponse attendue dans l'application.",
    },
    AR: {
      titre: "اعتراض جديد على الواجبات",
      corps: "يعترض أحد السكان على سطر من الواجبات: « {{motif}} ». الرد مطلوب في التطبيق.",
    },
  },
  CONTESTATION_REPONSE: {
    FR: {
      titre: "Réponse à votre contestation",
      corps: "Le syndic a répondu à votre contestation (suite : {{statut}}). Consultez la réponse dans l'application.",
    },
    AR: {
      titre: "رد على اعتراضكم",
      corps: "رد السنديك على اعتراضكم (الإجراء: {{statut}}). اطلعوا على الرد في التطبيق.",
    },
  },
  PAIEMENT_RECU: {
    FR: {
      titre: "Paiement enregistré",
      corps: "Un paiement de {{montant}} MAD a été enregistré pour votre lot. Votre solde est à jour dans l'application.",
    },
    AR: {
      titre: "تم تسجيل دفعة",
      corps: "سُجلت دفعة بمبلغ {{montant}} درهم لوحدتكم. رصيدكم محدَّث في التطبيق.",
    },
  },
  AG_OUVERTE: {
    FR: {
      titre: "Assemblée générale ouverte",
      corps: "L'assemblée générale du {{date_ag}} est ouverte : les votes sont accessibles dans l'application.",
    },
    AR: {
      titre: "الجمع العام مفتوح",
      corps: "الجمع العام المنعقد بتاريخ {{date_ag}} مفتوح: يمكنكم التصويت الآن في التطبيق.",
    },
  },
  DOCUMENT_PUBLIE: {
    FR: {
      titre: "Nouveau document",
      corps: "« {{nom}} » a été ajouté aux documents de votre copropriété.",
    },
    AR: {
      titre: "وثيقة جديدة",
      corps: "تمت إضافة « {{nom}} » إلى وثائق ملكيتكم المشتركة.",
    },
  },
  LOT_RATTACHE: {
    FR: {
      titre: "Lot rattaché à votre compte",
      corps: "Vous êtes désormais enregistré(e) comme {{qualite}} du lot {{numero}}.",
    },
    AR: {
      titre: "تم ربط حصة بحسابكم",
      corps: "تم تسجيلكم بصفة {{qualite}} للحصة {{numero}}.",
    },
  },
  AG_ANNULEE: {
    FR: {
      titre: "Assemblée générale annulée",
      corps: "L'assemblée générale prévue le {{date_ag}} est annulée. Motif : {{motif}}",
    },
    AR: {
      titre: "إلغاء الجمع العام",
      corps: "أُلغي الجمع العام المقرر بتاريخ {{date_ag}}. السبب: {{motif}}",
    },
  },
  INVITATION_ACCEPTEE: {
    FR: {
      titre: "Invitation acceptée",
      corps: "Un nouveau membre ({{role}}) vient de rejoindre la copropriété.",
    },
    AR: {
      titre: "تم قبول الدعوة",
      corps: "انضم عضو جديد ({{role}}) إلى الملكية المشتركة.",
    },
  },
};

// Escalade impayés N1–N6 (Doc A §3.3) + variantes syndic N4–N6.
const IMPAYES: Record<string, Entree> = {
  IMPAYE_N1: {
    FR: { titre: "Rappel d'échéance", corps: "Votre appel de fonds est arrivé à échéance. Merci de régulariser." },
    AR: { titre: "تذكير بالاستحقاق", corps: "حل أجل أداء مساهمتكم. المرجو التسوية." },
  },
  IMPAYE_N2: {
    FR: { titre: "Relance formelle", corps: "Relance formelle : votre solde de charges reste impayé. Merci de régulariser rapidement." },
    AR: { titre: "إشعار رسمي", corps: "إشعار رسمي: ما زالت مساهمتكم غير مؤداة. المرجو التسوية في أقرب وقت." },
  },
  IMPAYE_N3: {
    FR: { titre: "Mise en demeure", corps: "Mise en demeure : à défaut de paiement, des intérêts légaux pourront s'appliquer." },
    AR: { titre: "إنذار قانوني", corps: "إنذار: في غياب الأداء، قد تُطبق الفوائد القانونية." },
  },
  IMPAYE_N4: {
    FR: { titre: "Plan d'apurement proposé", corps: "Un plan de paiement échelonné vous est proposé. Contactez votre syndic." },
    AR: { titre: "اقتراح جدولة الأداء", corps: "نقترح عليكم جدولة الأداء. المرجو الاتصال بالسنديك." },
  },
  IMPAYE_N5: {
    FR: { titre: "Suspension de services", corps: "Selon le règlement, certains services peuvent être suspendus pour impayé." },
    AR: { titre: "تعليق الخدمات", corps: "وفق النظام الداخلي، قد تُعلق بعض الخدمات بسبب عدم الأداء." },
  },
  IMPAYE_N6: {
    FR: { titre: "Dossier contentieux", corps: "Votre dossier d'impayé est transmis pour injonction de payer (Art. 39, Loi 18-00)." },
    AR: { titre: "ملف نزاع قضائي", corps: "أحيل ملف عدم الأداء الخاص بكم لاستصدار أمر بالأداء (المادة 39، قانون 18-00)." },
  },
  IMPAYE_N4_SYNDIC: {
    FR: { titre: "Impayé N4 — action requise", corps: "Un lot atteint le palier N4 : négocier le plan d'apurement." },
    AR: { titre: "متأخرات N4 — إجراء مطلوب", corps: "بلغت شقة المستوى N4: يلزم التفاوض على جدولة الأداء." },
  },
  IMPAYE_N5_SYNDIC: {
    FR: { titre: "Impayé N5 — action requise", corps: "Un lot atteint le palier N5 : décider la suspension de services." },
    AR: { titre: "متأخرات N5 — إجراء مطلوب", corps: "بلغت شقة المستوى N5: يلزم البت في تعليق الخدمات." },
  },
  IMPAYE_N6_SYNDIC: {
    FR: { titre: "Impayé N6 — action requise", corps: "Un lot atteint le palier N6 : préparer le dossier d'injonction à payer." },
    AR: { titre: "متأخرات N6 — إجراء مطلوب", corps: "بلغت شقة المستوى N6: يلزم إعداد ملف الأمر بالأداء." },
  },
};
Object.assign(TEMPLATES, IMPAYES);

// ── M16 — Dépenses (Doc A §8.3 approbation conseil, §3.6 fonds de réserve) ─────────────────
// ⚠️ Chaînes AR : première passe machine, à faire relire par un locuteur natif avant production.
const DEPENSES: Record<string, Entree> = {
  DEPENSE_A_APPROUVER: {
    FR: {
      titre: "Dépense à approuver",
      corps: "« {{libelle}} » ({{montant}} MAD) dépasse le seuil d'approbation : votre décision est attendue dans l'application.",
    },
    AR: {
      titre: "نفقة تنتظر الموافقة",
      corps: "«{{libelle}}» ({{montant}} درهم) تتجاوز سقف الموافقة: قرارك مطلوب في التطبيق.",
    },
  },
  DEPENSE_APPROUVEE: {
    FR: { titre: "Dépense approuvée", corps: "« {{libelle}} » ({{montant}} MAD) a été approuvée. Vous pouvez procéder au paiement." },
    AR: { titre: "تمت الموافقة على النفقة", corps: "تمت الموافقة على «{{libelle}}» ({{montant}} درهم). يمكنكم المباشرة بالدفع." },
  },
  DEPENSE_REJETEE: {
    FR: { titre: "Dépense rejetée", corps: "« {{libelle}} » ({{montant}} MAD) a été rejetée : {{motif}}" },
    AR: { titre: "تم رفض النفقة", corps: "تم رفض «{{libelle}}» ({{montant}} درهم): {{motif}}" },
  },
  FACTURE_ECHEANCE_PROCHE: {
    FR: {
      titre: "Facture à régler bientôt",
      corps: "La facture {{numero}} ({{montant}} MAD, {{prestataire}}) arrive à échéance le {{date_echeance}}.",
    },
    AR: {
      titre: "فاتورة مستحقة قريبًا",
      corps: "الفاتورة {{numero}} ({{montant}} درهم، {{prestataire}}) تستحق بتاريخ {{date_echeance}}.",
    },
  },
};
Object.assign(TEMPLATES, DEPENSES);

// ── M17 — Justificatifs de paiement (Doc A §3.3/§3.4) ───────────────────────────────────────
const JUSTIFICATIFS: Record<string, Entree> = {
  JUSTIFICATIF_DECLARE: {
    FR: { titre: "Paiement déclaré à valider", corps: "Lot {{lot}} : {{montant}} MAD déclarés ({{methode}}). Vérifiez le relevé puis validez dans l'application." },
    AR: { titre: "دفعة مُصرَّح بها تنتظر التحقق", corps: "الوحدة {{lot}}: تم التصريح بدفع {{montant}} درهم ({{methode}}). راجعوا الكشف البنكي ثم صادقوا في التطبيق." },
  },
  PAIEMENT_VALIDE: {
    FR: { titre: "Paiement validé", corps: "Votre paiement de {{montant}} MAD (lot {{lot}}) a été validé par le syndic. Votre quittance est disponible dans l'application." },
    AR: { titre: "تم التحقق من الدفع", corps: "تم التحقق من دفعتكم بقيمة {{montant}} درهم (الوحدة {{lot}}) من طرف السنديك. وصل الأداء متوفر في التطبيق." },
  },
  JUSTIFICATIF_REJETE: {
    FR: { titre: "Paiement déclaré non validé", corps: "Votre déclaration de {{montant}} MAD (lot {{lot}}) n'a pas été validée : {{motif}}" },
    AR: { titre: "لم يتم التحقق من الدفعة المصرَّح بها", corps: "لم يتم التحقق من تصريحكم بقيمة {{montant}} درهم (الوحدة {{lot}}): {{motif}}" },
  },
  JUSTIFICATIF_A_VALIDER_RELANCE: {
    FR: { titre: "Justificatifs en attente", corps: "{{nb}} paiement(s) déclaré(s) attendent votre validation depuis plus de {{jours}} jours." },
    AR: { titre: "إثباتات دفع قيد الانتظار", corps: "{{nb}} دفعة/دفعات مصرَّح بها تنتظر تحققكم منذ أكثر من {{jours}} يومًا." },
  },
  PAIEMENT_ESPECES_SAISI: {
    FR: { titre: "Espèces reçues à la loge", corps: "Le gardien a enregistré {{montant}} MAD en espèces pour le lot {{lot}} : à confirmer dans l'application." },
    AR: { titre: "نقود مستلمة بالحراسة", corps: "سجّل الحارس {{montant}} درهم نقدًا للوحدة {{lot}}: يُرجى التأكيد في التطبيق." },
  },
};
Object.assign(TEMPLATES, JUSTIFICATIFS);

// ── M18 — Rapports de gestion (Doc A §8 reddition des comptes, §6 approbation en AG) ─────────
const RAPPORTS: Record<string, Entree> = {
  RAPPORT_GESTION_DISPONIBLE: {
    FR: { titre: "Rapport de gestion {{exercice}} disponible", corps: "Le rapport de gestion de l'exercice {{exercice}} est soumis à l'approbation de l'AG du {{date_ag}}. Consultez-le dans l'application (Documents / Transparence)." },
    AR: { titre: "تقرير التسيير {{exercice}} متاح", corps: "تقرير التسيير للسنة المالية {{exercice}} معروض على مصادقة الجمعية العامة بتاريخ {{date_ag}}. يمكنكم الاطلاع عليه في التطبيق (الوثائق / الشفافية)." },
  },
};
Object.assign(TEMPLATES, RAPPORTS);

export function templateExiste(code: string): boolean {
  return code in TEMPLATES;
}

export function render(
  code: string,
  langue: "FR" | "AR",
  params: Record<string, unknown> = {}
): TemplateRendu {
  const entree = TEMPLATES[code];
  if (!entree) {
    throw new TemplateInconnuError(`Template de notification inconnu : "${code}" (registre lib/notifications/templates.ts).`);
  }
  const bloc = entree[langue];
  const interpoler = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_, cle: string) => {
      const v = params[cle];
      return v === undefined || v === null ? "—" : String(v);
    });
  return { titre: interpoler(bloc.titre), corps: interpoler(bloc.corps), langue };
}
