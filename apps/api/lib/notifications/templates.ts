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
