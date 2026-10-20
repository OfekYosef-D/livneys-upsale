import { fields, z } from '@/lib/validation';
import type { ManualOrderIntakeChannel } from '../orders/write';

const intakeChannels = ['PHONE', 'WHATSAPP', 'ADMIN_MANUAL'] as const satisfies readonly ManualOrderIntakeChannel[];
const promotionEffectTypes = ['DISPLAY_ONLY', 'PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FIXED_UNIT_PRICE', 'BUY_X_GET_Y'] as const;

export const activeToggleSchema = z.object({ id: fields.id, isActive: z.boolean() });

export const customerSchema = z.object({
  id: fields.id.optional(),
  name: fields.requiredText(160),
  invoiceName: fields.optionalText(160),
  contact: fields.requiredText(120),
  email: fields.optionalEmail,
  phone: fields.phone,
  accountingContactName: fields.optionalText(120),
  accountingEmail: fields.optionalEmail,
  accountingPhone: fields.optionalText(40),
  businessType: fields.optionalText(80),
  region: fields.requiredText(120),
  address: fields.requiredText(240),
  deliveryConstraints: fields.optionalText(1000),
  routeId: fields.id,
  priceListId: fields.id,
  notes: fields.optionalText(1000),
  statusLabel: fields.optionalText(120),
  isActive: z.boolean(),
  emailEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
});

export const productSchema = z
  .object({
    id: fields.id.optional(),
    sku: fields.requiredText(80).transform((value) => value.toUpperCase()),
    name: fields.requiredText(160),
    category: fields.requiredText(120),
    description: fields.optionalText(1000),
    basePrice: fields.positivePrice,
    unit: fields.requiredText(40),
    caseSize: fields.requiredText(80),
    minQty: z.coerce.number().int().min(1),
    orderMultiple: z.coerce.number().int().min(1).default(1),
    imageUrl: z.preprocess((value) => (value === '' || value === undefined ? null : value), z.string().trim().url().max(500).nullable()),
    assetImage: fields.optionalText(240),
    stockLabel: fields.optionalText(120),
    isActive: z.boolean(),
    prices: z.array(z.object({ priceListId: fields.id, price: fields.positivePrice })).default([]),
  })
  .refine((value) => value.minQty % value.orderMultiple === 0 || value.minQty < value.orderMultiple, {
    path: ['minQty'],
    message: 'כמות המינימום צריכה להתאים לכפולת ההזמנה (למשל מינימום 6 עם כפולה 6).',
  });

export const quickProductUpdateSchema = z
  .object({
    id: fields.id,
    basePrice: fields.positivePrice.optional(),
    minQty: z.coerce.number().int().min(1).optional(),
  })
  .refine((value) => value.basePrice !== undefined || value.minQty !== undefined, { message: 'יש לעדכן מחיר או כמות מינימום.' });

export const bulkCategoryPriceSchema = z.object({
  category: fields.requiredText(120),
  price: fields.positivePrice,
});

export const routeSchema = z.object({
  id: fields.id.optional(),
  name: fields.requiredText(120),
  region: fields.requiredText(120),
  driver: fields.optionalText(120),
  opsContactName: fields.optionalText(120),
  opsContactPhone: fields.optionalText(40),
  deliveryWeekday: z.coerce.number().int().min(0).max(6),
  cutoffWeekday: z.coerce.number().int().min(0).max(6),
  cutoffTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'שעה לא תקינה.'),
  /** Optional one-off override of the next delivery date (YYYY-MM-DD), e.g. around holidays. */
  nextDeliveryDate: z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך לא תקין.').nullable(),
  ),
  isActive: z.boolean(),
});

export const promotionSchema = z
  .object({
    id: fields.id.optional(),
    title: fields.requiredText(160),
    tag: fields.requiredText(60),
    description: fields.requiredText(1000),
    effectType: z.enum(promotionEffectTypes).default('DISPLAY_ONLY'),
    discountValue: fields.optionalNumber,
    buyQuantity: fields.optionalNumber,
    freeQuantity: fields.optionalNumber,
    priority: z.coerce.number().int().min(0).default(0),
    productIds: fields.stringList,
    categories: fields.stringList,
    customerIds: fields.stringList,
    routeIds: fields.stringList,
    priceListIds: fields.stringList,
    startsAt: fields.optionalIsraelDateTime,
    endsAt: fields.optionalIsraelDateTime,
    isActive: z.boolean(),
  })
  .refine((value) => !value.startsAt || !value.endsAt || value.startsAt < value.endsAt, {
    path: ['endsAt'],
    message: 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה.',
  })
  .refine((value) => ['DISPLAY_ONLY', 'BUY_X_GET_Y'].includes(value.effectType) || (value.discountValue ?? 0) > 0, {
    path: ['discountValue'],
    message: 'יש להזין ערך הנחה או מחיר לסוג מבצע זה.',
  })
  .refine((value) => value.effectType !== 'PERCENT_OFF' || (value.discountValue ?? 0) <= 100, {
    path: ['discountValue'],
    message: 'אחוז הנחה חייב להיות בין 0 ל-100.',
  })
  .refine((value) => value.effectType !== 'BUY_X_GET_Y' || ((value.buyQuantity ?? 0) >= 1 && (value.freeQuantity ?? 0) >= 1), {
    path: ['buyQuantity'],
    message: 'במבצע "קנה X קבל Y" יש להזין את שתי הכמויות.',
  });

export const priceListSchema = z.object({
  id: fields.id.optional(),
  name: fields.requiredText(160),
  description: fields.optionalText(500),
  isDefault: z.boolean(),
  prices: z.array(z.object({ productId: fields.id, price: fields.positivePrice })).min(1),
});

export const clonePriceListSchema = z.object({ id: fields.id, name: fields.requiredText(160) });

export const recommendationSchema = z.object({
  id: fields.id.optional(),
  customerId: fields.id,
  productId: fields.id,
  reason: fields.optionalText(500),
  isActive: z.boolean(),
});

export const manualOrderSchema = z.object({
  customerId: fields.id,
  idempotencyKey: fields.idempotencyKey,
  vatRatePercent: z.coerce.number().positive().max(100),
  items: z.array(z.object({ productId: fields.id, quantity: z.coerce.number().int().positive() })).min(1, 'בחרו לפחות מוצר אחד.'),
  notes: fields.optionalText(1000),
  internalNote: fields.optionalText(1000),
  intakeChannel: z.enum(intakeChannels),
});

export type CustomerInput = z.output<typeof customerSchema>;
export type ProductInput = z.output<typeof productSchema>;
export type RouteInput = z.output<typeof routeSchema>;
export type PromotionInput = z.output<typeof promotionSchema>;
export type PriceListInput = z.output<typeof priceListSchema>;
export type RecommendationInput = z.output<typeof recommendationSchema>;
