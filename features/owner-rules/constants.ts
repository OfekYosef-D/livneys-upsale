export const MINIMUM_INSTITUTIONAL_ORDER_TOTAL = 700;

export const PRICES_BEFORE_VAT_LABEL = 'מחירי המחירון לפני מע״מ';

export const INSTITUTIONAL_PRICING_NOTICE =
  'המחירון מיועד ללקוחות עסקיים ומוסדיים. הסכום כולל מע״מ מוצג בסל ובסיכום ההזמנה.';

export const institutionalBusinessTypes = [
  'מעדניות',
  'בתי קפה',
  'עגלות קפה',
  'קייטרינג',
  'יקבים',
  'ברי יין',
] as const;

export const defaultInstitutionalRouteNames = [
  'עמק יזרעאל וגלבוע',
  'גליל עליון וגולן',
  'גליל מערבי',
  'חיפה',
  'כביש החוף עתלית עד הרצליה',
  'תל אביב',
  'צפון שרון',
  'דרום שרון',
  'ירושלים',
  'עוטף עזה',
] as const;

export const productPricePresets = [
  {
    id: 'spread-185',
    label: 'ממרחים וריבות 185/210 גרם',
    unit: 'צנצנת 185 גרם',
    caseSize: '12 יחידות בארגז',
    minQty: 6,
    orderMultiple: 6,
    price: 16.9,
  },
  {
    id: 'herb-185',
    label: 'זעתר וטימין 185 גרם',
    unit: 'צנצנת 185 גרם',
    caseSize: '12 יחידות בארגז',
    minQty: 6,
    orderMultiple: 6,
    price: 21.5,
  },
  {
    id: 'institutional-500',
    label: 'מוסדי 500 גרם',
    unit: 'צנצנת 500 גרם',
    caseSize: '4 יחידות בארגז',
    minQty: 4,
    orderMultiple: 4,
    price: 35,
  },
  {
    id: 'herb-institutional-500',
    label: 'זעתר וטימין מוסדי 500 גרם',
    unit: 'צנצנת 500 גרם',
    caseSize: '4 יחידות בארגז',
    minQty: 4,
    orderMultiple: 4,
    price: 45,
  },
] as const;

export const promotionPresets = [
  {
    id: 'winery-volume',
    label: 'הנחת כמות ליקבים',
    title: 'הנחת כמות ליקבים',
    tag: 'כמות גדולה',
    description: 'הנחת כמות ליקבים או לקוחות עם נפח גבוה. הגדירו אחוז יעד ולקוחות מתאימים.',
    effectType: 'PERCENT_OFF',
    discountValue: 5,
  },
] as const;
