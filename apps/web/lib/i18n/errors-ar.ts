/**
 * مفردات اللحظات الصعبة — بالعربية. نفس بنية errors-fr.ts حرفيًا (أي مفتاح ناقص = خطأ في الأنواع).
 */
import type { errorsFr, errorActionsFr, boundaryFr, viewerFr, staleFr, referenceFr } from "./errors-fr";

type DeepDict<T> = { [K in keyof T]: T[K] extends object ? DeepDict<T[K]> : string };

export const errorActionsAr: DeepDict<typeof errorActionsFr> = {
  retry: "إعادة المحاولة",
  relogin: "تسجيل الدخول من جديد",
  refresh: "تحديث",
  contact: "تواصلوا مع السنديك إذا استمر المشكل.",
  backHome: "العودة إلى الرئيسية",
  login: "تسجيل الدخول",
};

export const boundaryAr: DeepDict<typeof boundaryFr> = {
  title: "تعذر عرض هذه الصفحة",
  body: "المشكل من جهتنا وليس من جهتكم. بياناتكم في أمان: أعيدوا المحاولة بعد لحظات.",
  notFoundTitle: "الصفحة غير موجودة",
  notFoundBody: "هذه الصفحة غير موجودة أو تم نقلها.",
};

export const viewerAr: DeepDict<typeof viewerFr> = {
  unavailable: "الوثيقة غير متاحة",
  unavailableBody: "لم نتمكن من فتح هذه الوثيقة حاليًا.",
  unknownType: "المعاينة غير متاحة لهذا النوع من الملفات: حمّلوه لفتحه.",
};

export const staleAr: DeepDict<typeof staleFr> = {
  lost: "انقطع الاتصال",
  lastUpdate: "آخر تحديث قبل {temps}",
  never: "في انتظار أول تحديث",
  seconds: "{n} ثانية",
  minutes: "{n} دقيقة",
  retry: "إعادة المحاولة",
};

export const referenceAr: DeepDict<typeof referenceFr> = {
  reference: "المرجع {ref}",
  referenceCopy: "نسخ المرجع",
  referenceCopied: "تم نسخ المرجع",
};

export const errorsAr: DeepDict<typeof errorsFr> = {
  actions: errorActionsAr,
  ...referenceAr,
  retryIn: "أعيدوا المحاولة بعد {temps}.",
  seconds: "{n} ثانية",
  minutes: "{n} دقيقة",

  codes: {
    VALIDATION_ERROR: { title: "بعض المعلومات تحتاج إلى تصحيح", body: "تحققوا من الحقول المشار إليها ثم أعيدوا المحاولة." },
    UNAUTHENTICATED: { title: "انتهت صلاحية جلستكم", body: "لأسباب أمنية، سجّلوا الدخول من جديد: ستعودون بعدها إلى هذه الصفحة." },
    FORBIDDEN: { title: "إجراء غير مسموح", body: "دوركم لا يسمح بهذا الإجراء في هذه الملكية المشتركة." },
    NOT_FOUND: { title: "العنصر غير موجود", body: "ربما حُذف أو نُقل. حدّثوا الصفحة لرؤية الوضع الحالي." },
    CONFLICT: { title: "تم بالفعل أو تغيّر في الأثناء", body: "ربما قام شخص آخر بنفس الإجراء. حدّثوا الصفحة لرؤية الوضع الحالي." },
    UNPROCESSABLE_ENTITY: { title: "الإجراء غير ممكن حاليًا", body: "قاعدة من قواعد الملكية المشتركة تمنع هذا الإجراء. تحققوا من المعلومات أو تواصلوا مع السنديك." },
    RATE_LIMITED: { title: "محاولات كثيرة", body: "انتظروا قليلًا قبل إعادة المحاولة." },
    INTERNAL_ERROR: { title: "حدث خطأ", body: "المشكل من جهتنا وليس من جهتكم. أعيدوا المحاولة بعد لحظات." },
    NOT_IMPLEMENTED: { title: "غير متاح بعد", body: "هذه الخاصية غير مفعّلة بعد لملكيتكم المشتركة." },
    SERVICE_UNAVAILABLE: { title: "الخدمة غير متاحة مؤقتًا", body: "الخدمة تحت ضغط كبير. أعيدوا المحاولة بعد لحظات." },
    NETWORK: { title: "تعذّر الاتصال", body: "لا نستطيع الوصول إلى SyndicUp. تحققوا من اتصالكم بالإنترنت ثم أعيدوا المحاولة." },
    UNEXPECTED: { title: "استجابة غير متوقعة", body: "ردّ الخادم بطريقة غير متوقعة. أعيدوا المحاولة بعد لحظات." },

    LCD_REGIME_NON_DEFINI: { title: "النظام غير محدد", body: "لم يحدد السنديك بعد نظام الكراء قصير المدة (قرار الجمع العام)." },
    LCD_INTERDITE: { title: "الكراء قصير المدة ممنوع", body: "نظام الملكية المشتركة يمنع الكراء قصير المدة." },
    LCD_PARAMETRE_NON_CONFIGURE: { title: "النظام يحتاج إلى استكمال", body: "على السنديك أولًا إدخال إعدادات نظام الكراء قصير المدة." },
    LCD_GESTIONNAIRE_REQUIS: { title: "مسيّر مطلوب", body: "يشترط النظام وجود مسيّر في عين المكان عندما لا يقيم المالك في الوحدة." },
    LCD_DECLARATION_NON_VALIDEE: { title: "تصريح غير مصادق عليه", body: "لا يتوفر هذا الوحدة بعد على تصريح كراء قصير المدة مصادق عليه." },
    LCD_QUOTA_NUITS_DEPASSE: { title: "تجاوز عدد الليالي", body: "تم بلوغ الحد الأقصى لعدد الليالي في السنة المحدد في النظام." },
    LCD_DELAI_DECLARATION: { title: "تصريح متأخر", body: "يفرض النظام التصريح بالإقامة قبل الوصول بمدة أطول." },
    LCD_VOYAGEURS_MAX: { title: "عدد المسافرين كبير", body: "يحدد النظام عددًا أقصى من المسافرين لكل وحدة." },
    LCD_SEJOUR_CHEVAUCHEMENT: { title: "التواريخ محجوزة", body: "توجد إقامة أخرى مصرّح بها على هذه الوحدة في نفس التواريخ." },

    DEPENSE_STATUT_INVALIDE: { title: "تغيّرت حالة المصروف", body: "هذا الإجراء لم يعد ممكنًا في الحالة الحالية للمصروف. حدّثوا الصفحة." },
    DEPENSE_APPROBATION_CONSEIL_REQUISE: { title: "موافقة المجلس مطلوبة", body: "هذا المصروف يتجاوز عتبة الموافقة: القرار يعود إلى مجلس الملاك." },
    DEPENSE_RESERVE_RESOLUTION_REQUISE: { title: "قرار الجمع العام مطلوب", body: "يجب ربط أي صرف من صندوق الاحتياط بقرار جمع عام مصادق عليه." },
    FONDS_RESERVE_INSUFFISANT: { title: "صندوق الاحتياط غير كافٍ", body: "رصيد صندوق الاحتياط لا يغطي هذا المبلغ." },
    BUDGET_TOTAL_DERIVE_DES_POSTES: { title: "المجموع يُحسب تلقائيًا", body: "مجموع الميزانية هو حاصل بنودها: عدّلوا البنود بدل المجموع." },
    BUDGET_POSTE_UTILISE: { title: "البند مستعمل", body: "توجد مصاريف مرتبطة بهذا البند: انقلوها إلى بند آخر قبل حذفه." },
    INCIDENT_NON_RESOLU: { title: "العطب لم يُحل بعد", body: "لا يمكن تقييم مقدم الخدمة إلا بعد حل العطب." },
    INCIDENT_DEJA_EVALUE: { title: "تم التقييم مسبقًا", body: "تم تقييم مقدم الخدمة هذا مسبقًا لهذا العطب." },

    JUSTIFICATIF_STATUT_INVALIDE: { title: "تغيّرت حالة الإثبات", body: "ربما تمت معالجته مسبقًا. حدّثوا الصفحة لرؤية حالته الحالية." },
    JUSTIFICATIF_PREUVE_REQUISE: { title: "إثبات الدفع مطلوب", body: "أرفقوا إثبات الدفع (وصل التحويل، صورة الشيك أو الوصل البنكي)." },
    JUSTIFICATIF_PARAMETRE_NON_CONFIGURE: { title: "إعداد يجب ضبطه", body: "على السنديك أولًا ضبط هذا الإعداد للملكية المشتركة." },

    RAPPORT_STATUT_INVALIDE: { title: "تغيّرت حالة التقرير", body: "هذا الإجراء لم يعد ممكنًا في الحالة الحالية للتقرير. حدّثوا الصفحة." },
    RAPPORT_PARAMETRE_NON_CONFIGURE: { title: "الأغلبية يجب ضبطها", body: "لم تُضبط بعد الأغلبية المطلوبة للمصادقة على الحسابات." },

    CONTRAT_STATUT_INVALIDE: { title: "تغيّرت حالة العقد", body: "هذا الإجراء لم يعد ممكنًا في الحالة الحالية للعقد. حدّثوا الصفحة." },
    CONTRAT_RESOLUTION_AG_REQUISE: { title: "قرار الجمع العام مطلوب", body: "المبلغ يتجاوز العتبة المحددة: اربطوا قرار جمع عام مصادق عليه قبل تفعيل العقد." },
    CONTRAT_ECHEANCE_STATUT_INVALIDE: { title: "تغيّرت حالة الاستحقاق", body: "ربما تمت معالجة هذا الاستحقاق مسبقًا. حدّثوا الصفحة." },

    PAIE_PARAMETRES_NON_CONFIGURES: { title: "إعدادات الأجور مطلوبة", body: "أدخلوا إعدادات الأجور (CNSS، AMO، IR، SMIG…) في الإعدادات قبل المصادقة." },
    PAIE_STATUT_INVALIDE: { title: "تغيّرت حالة الأجر", body: "هذا الإجراء لم يعد ممكنًا في الحالة الحالية للأجر. حدّثوا الصفحة." },
    CONGE_STATUT_INVALIDE: { title: "تغيّرت حالة العطلة", body: "ربما تمت معالجة هذا الطلب مسبقًا. حدّثوا الصفحة." },
    CONGE_SOLDE_INSUFFISANT: { title: "رصيد العطل غير كافٍ", body: "الرصيد المتاح لا يغطي عدد الأيام المطلوبة." },
    PERSONNEL_STATUT_INVALIDE: { title: "تغيّرت حالة البطاقة", body: "هذا الإجراء لم يعد ممكنًا في الحالة الحالية للبطاقة. حدّثوا الصفحة." },

    ANNONCE_STATUT_INVALIDE: { title: "تغيّرت حالة الإعلان", body: "هذا الإجراء لم يعد ممكنًا في الحالة الحالية للإعلان. حدّثوا الصفحة." },
    COMMENTAIRES_DESACTIVES: { title: "التعليقات معطّلة", body: "التعليقات معطّلة على هذا الإعلان." },
    SONDAGE_STATUT_INVALIDE: { title: "تغيّرت حالة الاستطلاع", body: "ربما لم يعد هذا الاستطلاع يقبل الأجوبة. حدّثوا الصفحة." },
    SONDAGE_DEJA_REPONDU: { title: "أجبتم مسبقًا", body: "لقد أجبتم مسبقًا على هذا الاستطلاع." },
    SONDAGE_CHOIX_INVALIDE: { title: "اختيار غير صالح", body: "هذا الاختيار لا يطابق خيارات الاستطلاع. حدّثوا الصفحة." },

    TACHE_STATUT_INVALIDE: { title: "تغيّرت حالة المهمة", body: "هذا الإجراء لم يعد ممكنًا في الحالة الحالية للمهمة. حدّثوا الصفحة." },
    TACHE_ASSIGNEE_INVALIDE: { title: "لا يمكن إسنادها لهذا الشخص", body: "لا تُسند المهمة إلا للسنديك أو لعضو في المجلس أو للمستخدمين." },

    EMPLACEMENT_STATUT_INVALIDE: { title: "تغيّرت حالة الموقف", body: "هذا الإجراء لم يعد ممكنًا لهذا الموقف. حدّثوا الصفحة." },
    EMPLACEMENT_CODE_EXISTANT: { title: "الرمز مستعمل", body: "يوجد موقف يحمل هذا الرمز مسبقًا." },
    EMPLACEMENT_NON_VISITEUR: { title: "ليس موقفًا للزوار", body: "اختاروا موقفًا للزوار في الخدمة." },
    ATTRIBUTION_CHEVAUCHEMENT: { title: "الفترة مخصصة مسبقًا", body: "الموقف مخصص مسبقًا خلال هذه الفترة." },
    IMMATRICULATION_EXISTANTE: { title: "اللوحة مصرّح بها مسبقًا", body: "رقم التسجيل هذا مصرّح به مسبقًا." },
    IMMATRICULATION_INCONNUE: { title: "لا توجد لوحة", body: "لم يُشر إلى أي لوحة في هذا العطب." },
    BADGE_STATUT_INVALIDE: { title: "تغيّرت حالة الشارة", body: "هذا الإجراء لم يعد ممكنًا لهذه الشارة. حدّثوا الصفحة." },
    BADGE_IDENTIFIANT_EXISTANT: { title: "الشارة مسجلة مسبقًا", body: "توجد شارة تحمل هذا المعرّف مسبقًا." },

    IMPORT_FICHIER_ILLISIBLE: { title: "ملف غير مقروء", body: "تعذرت قراءة الملف. تحققوا من أنه ملف xlsx أو csv مأخوذ من النموذج." },
    IMPORT_STATUT_INVALIDE: { title: "تغيّرت حالة الاستيراد", body: "ربما تمت معالجة هذا الاستيراد مسبقًا. حدّثوا الصفحة." },
    DEMO_INTERDIT: { title: "غير متاح في العرض التجريبي", body: "هذا الإجراء معطّل في الملكية المشتركة التجريبية." },

    CABINET_STATUT_INVALIDE: { title: "تغيّرت حالة المكتب", body: "هذا الإجراء لم يعد ممكنًا لهذا المكتب. حدّثوا الصفحة." },
    MANDAT_EXISTANT: { title: "توجد وكالة مسبقًا", body: "توجد وكالة نشطة أو قيد الانتظار على هذه الملكية المشتركة." },
    MANDAT_STATUT_INVALIDE: { title: "تغيّرت حالة الوكالة", body: "هذا الإجراء لم يعد ممكنًا لهذه الوكالة. حدّثوا الصفحة." },
    CONFLIT_SYNDIC: { title: "يوجد سنديك مسبقًا", body: "يوجد سنديك نشط مسبقًا لهذه الملكية المشتركة." },
  },

  local: {
    fichierTropLourd: "الملف كبير جدًا ({max} ميغا كحد أقصى).",
    fichierTropLourdCourt: "{max} ميغا كحد أقصى.",
    imageTropLourde: "الصورة كبيرة جدًا ({max} ميغا كحد أقصى).",
    fichierManquant: "اختاروا ملفًا.",
    imageManquante: "اختاروا صورة.",
    aucunFichier: "لم يتم اختيار أي ملف.",
    fichierImportRequis: "اختاروا ملف xlsx أو csv.",
    factureObligatoire: "ملف الفاتورة إلزامي.",
    emplacementInconnu: "موضع الصورة غير معروف. حدّثوا الصفحة.",
    emailInvalide: "يبدو أن عنوان البريد الإلكتروني غير صالح.",
    televersementRefuse: "تعذر إرسال الملف. أعيدوا المحاولة بعد لحظات.",
    televersementRefuseTitre: "تعذر إرسال الملف",
  },

  load: {
    title: "تعذر تحميل هذه المعلومات حاليًا",
    body: "القائمة ليست فارغة: لم نتمكن من جلبها. أعيدوا المحاولة بعد لحظات.",
    section: "تعذر تحميل هذا القسم حاليًا.",
    solde: "الرصيد غير متاح",
    soldeAide: "لم نتمكن من حساب رصيدكم. قد لا يكون محيّنًا: أعيدوا المحاولة.",
  },

  stale: staleAr,

  forbidden: {
    title: "لا يمكنكم الوصول إلى هذه الصفحة",
    body: "دوركم في هذه الملكية المشتركة لا يسمح بفتح هذه الصفحة. إذا كنتم تظنون أن هذا خطأ، تواصلوا مع السنديك.",
    toast: "لا يمكنكم الوصول إلى هذه الصفحة.",
    abonnementTitre: "الاشتراك معلّق",
    abonnementCorps: "اشتراك ملكيتكم المشتركة معلّق: بعض الصفحات غير متاحة مؤقتًا. تواصلوا مع السنديك لإعادة تفعيله.",
  },

  boundary: boundaryAr,

  viewer: viewerAr,
};
