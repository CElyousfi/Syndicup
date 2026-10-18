/** نصوص اللحظات الصعبة المستعملة في جهة العميل — نفس بنية errors-ui-fr.ts. */
import type { errorActionsFr, boundaryFr, viewerFr, staleFr, referenceFr } from "./errors-ui-fr";

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
