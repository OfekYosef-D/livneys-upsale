export const LEGAL_DOCUMENT_SET_VERSION = '2026-08-12-review';

export type LegalDocumentDefinition = {
  type: 'COMMERCIAL_TERMS' | 'PRIVACY_POLICY' | 'CANCELLATION_RETURNS';
  slug: 'commercial-terms' | 'privacy' | 'cancellations';
  title: string;
  version: string;
  sections: Array<{ heading: string; body: string }>;
};

export const legalDocuments: LegalDocumentDefinition[] = [
  {
    type: 'COMMERCIAL_TERMS',
    slug: 'commercial-terms',
    title: 'תנאים מסחריים להזמנות מוסדיות',
    version: LEGAL_DOCUMENT_SET_VERSION,
    sections: [
      {
        heading: 'תחולה ואישור הזמנה',
        body: 'המערכת מיועדת ללקוחות עסקיים ומוסדיים בלבד. שליחת הזמנה היא בקשה לאישור ואינה מהווה התחייבות לאספקה עד לאישור סופי של ליבני׳ס ובהתאם לזמינות המוצרים.',
      },
      {
        heading: 'מחירים, מע״מ ותשלום',
        body: 'מחירי המחירון מוצגים לפני מע״מ. שיעור המע״מ והסכום הכולל נשמרים בהזמנה לפי המועד שבו נשלחה. בתשלום מיידי או מזומן ניתנת הנחה של 5% לאחר הנחות מוצר; אחרת תנאי התשלום הם שוטף 30, אלא אם סוכם אחרת בכתב.',
      },
      {
        heading: 'מסמכי מס',
        body: 'ההזמנה והמסכים באתר אינם חשבונית מס, קבלה או אישור תשלום. מסמכי המס מופקים במערכת הנהלת החשבונות של העסק ונמסרים בנפרד כדין.',
      },
    ],
  },
  {
    type: 'PRIVACY_POLICY',
    slug: 'privacy',
    title: 'מדיניות פרטיות',
    version: LEGAL_DOCUMENT_SET_VERSION,
    sections: [
      {
        heading: 'המידע שנאסף',
        body: 'לצורך פתיחת חשבון, הזמנות ושירות נאספים פרטי החברה ואנשי הקשר, כתובות אספקה, היסטוריית הזמנות, פעולות משתמש, נתוני אבטחה ותכתובות תפעוליות.',
      },
      {
        heading: 'מטרות ושירותים תומכים',
        body: 'המידע משמש לניהול ההתקשרות, אספקה, חיוב, תמיכה, אבטחה ותיעוד. מידע נמסר רק לספקים הנדרשים להפעלת השירות, כגון אירוח, מסד נתונים, דיוור והודעות, בכפוף להגנות חוזיות וטכניות מתאימות.',
      },
      {
        heading: 'שמירה וזכויות',
        body: 'המידע נשמר לפי צורכי ההתקשרות והדין. ניתן לפנות לבעל העסק בבקשה לעיון, תיקון או בירור, בכפוף לחובות שמירת מסמכים ולהגנה על זכויות צדדים אחרים.',
      },
    ],
  },
  {
    type: 'CANCELLATION_RETURNS',
    slug: 'cancellations',
    title: 'ביטולים, שינויים והחזרות',
    version: LEGAL_DOCUMENT_SET_VERSION,
    sections: [
      {
        heading: 'שינויים ותוספות',
        body: 'בקשת תוספת להזמנה מחייבת אישור מנהל ואפשרית רק לפני אריזת ההזמנה. עצם שליחת הבקשה אינה מבטיחה את אישורה או את זמינות המוצרים.',
      },
      {
        heading: 'ביטול הזמנה',
        body: 'בקשת ביטול תועבר לבעל העסק בהקדם. לאחר שההזמנה אושרה, הוכנה או נארזה, הביטול כפוף לאישור בכתב ולעלויות שכבר נגרמו, בהתחשב באופי המוצרים ובהסכמות המסחריות.',
      },
      {
        heading: 'חוסר או פגם',
        body: 'יש לדווח ללא דיחוי על חוסר, נזק או אי-התאמה ולצרף פרטי הזמנה ותיעוד מתאים. הטיפול ייקבע לפי נסיבות המקרה, תנאי ההתקשרות והדין החל.',
      },
    ],
  },
];

export function getLegalDocument(slug: string) {
  return legalDocuments.find((document) => document.slug === slug) ?? null;
}

/** Set LEGAL_DOCUMENTS_APPROVED_VERSION to the current set version once a lawyer approves the wording. */
export function isLegalVersionApproved(env: Record<string, string | undefined> = process.env): boolean {
  return env.LEGAL_DOCUMENTS_APPROVED_VERSION === LEGAL_DOCUMENT_SET_VERSION;
}
