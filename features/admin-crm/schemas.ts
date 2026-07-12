import { z } from 'zod';
import type { ManualOrderIntakeChannel } from '@/features/orders/write';

const intakeChannels = ['PHONE', 'WHATSAPP', 'ADMIN_MANUAL'] as const satisfies ManualOrderIntakeChannel[];
const promotionEffectTypes = ['DISPLAY_ONLY', 'PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FIXED_UNIT_PRICE', 'BUY_X_GET_Y'] as const;

const requiredText = (max: number) => z.string().trim().min(1).max(max);

const nullableText = (max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().max(max).nullable());

const nullableEmail = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}, z.string().email().max(254).nullable());

const nullableDate = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return null;
  return value;
}, z.coerce.date().nullable());

const nullableNumber = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return null;
  return value;
}, z.coerce.number().nullable());

const stringArray = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item.trim() : item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}, z.array(requiredText(160)).default([]));

export const priceListPriceSchema = z.object({
  productId: requiredText(120),
  price: z.coerce.number().positive(),
});

export const productPriceSchema = z.object({
  priceListId: requiredText(120),
  price: z.coerce.number().positive(),
});

export const customerMutationSchema = z.object({
  name: requiredText(160),
  invoiceName: nullableText(160),
  contact: requiredText(120),
  email: nullableEmail,
  phone: requiredText(40),
  accountingContactName: nullableText(120),
  accountingEmail: nullableEmail,
  accountingPhone: nullableText(40),
  businessType: nullableText(80),
  region: requiredText(120),
  address: requiredText(240),
  deliveryConstraints: nullableText(1000),
  routeId: requiredText(120),
  priceListId: requiredText(120),
  notes: nullableText(1000),
  statusLabel: nullableText(120),
  isActive: z.boolean(),
  emailEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
});

export const createCustomerSchema = customerMutationSchema.extend({
  id: nullableText(80).optional(),
});

export const updateCustomerSchema = customerMutationSchema.extend({
  id: requiredText(120),
});

export const productMutationSchema = z.object({
  sku: requiredText(80).transform((value) => value.toUpperCase()),
  name: requiredText(160),
  category: requiredText(120),
  description: nullableText(1000),
  basePrice: z.coerce.number().positive(),
  unit: requiredText(40),
  caseSize: requiredText(80),
  minQty: z.coerce.number().int().min(1),
  orderMultiple: z.coerce.number().int().min(1).default(1),
  imageUrl: z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return null;
    return value;
  }, z.string().trim().url().max(500).nullable()),
  assetImage: nullableText(240),
  stockLabel: nullableText(120),
  isActive: z.boolean(),
  prices: z.array(productPriceSchema).default([]),
});

export const createProductSchema = productMutationSchema.extend({
  id: nullableText(120).optional(),
});

export const updateProductSchema = productMutationSchema.extend({
  id: requiredText(120),
});

export const routeMutationSchema = z
  .object({
    name: requiredText(120),
    region: requiredText(120),
    driver: nullableText(120),
    opsContactName: nullableText(120),
    opsContactPhone: nullableText(40),
    deliveryWeekday: z.coerce.number().int().min(0).max(6),
    cutoffWeekday: z.coerce.number().int().min(0).max(6),
    cutoffTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
    nextDeliveryAt: z.coerce.date(),
    nextCutoffAt: z.coerce.date(),
    isActive: z.boolean(),
  })
  .refine((value) => value.nextCutoffAt.getTime() <= value.nextDeliveryAt.getTime(), {
    path: ['nextCutoffAt'],
    message: 'Cutoff must be before delivery',
  });

export const createRouteSchema = routeMutationSchema.extend({
  id: nullableText(120).optional(),
});

export const updateRouteSchema = routeMutationSchema.extend({
  id: requiredText(120),
});

export const promotionMutationSchema = z
  .object({
    title: requiredText(160),
    tag: requiredText(60),
    description: requiredText(1000),
    productId: nullableText(120).optional(),
    effectType: z.enum(promotionEffectTypes).default('DISPLAY_ONLY'),
    discountValue: nullableNumber,
    buyQuantity: nullableNumber,
    freeQuantity: nullableNumber,
    priority: z.coerce.number().int().min(0).default(0),
    productIds: stringArray,
    categories: stringArray,
    customerIds: stringArray,
    routeIds: stringArray,
    priceListIds: stringArray,
    startsAt: nullableDate,
    endsAt: nullableDate,
    isActive: z.boolean(),
  })
  .refine((value) => !value.startsAt || !value.endsAt || value.startsAt.getTime() < value.endsAt.getTime(), {
    path: ['endsAt'],
    message: 'Promotion end must be after start',
  })
  .refine((value) => value.effectType === 'DISPLAY_ONLY' || value.effectType === 'BUY_X_GET_Y' || ((value.discountValue ?? 0) > 0), {
    path: ['discountValue'],
    message: 'Discount value is required for this promotion type',
  })
  .refine((value) => value.effectType !== 'PERCENT_OFF' || ((value.discountValue ?? 0) > 0 && (value.discountValue ?? 0) <= 100), {
    path: ['discountValue'],
    message: 'Percent discount must be between 0 and 100',
  })
  .refine((value) => value.effectType !== 'BUY_X_GET_Y' || ((value.buyQuantity ?? 0) >= 1 && (value.freeQuantity ?? 0) >= 1), {
    path: ['buyQuantity'],
    message: 'Buy/free quantities are required for bundle promotions',
  });

export const createPromotionSchema = promotionMutationSchema.extend({
  id: nullableText(120).optional(),
});

export const updatePromotionSchema = promotionMutationSchema.extend({
  id: requiredText(120),
});

export const priceListMutationSchema = z.object({
  name: requiredText(160),
  description: nullableText(500),
  isDefault: z.boolean(),
  prices: z.array(priceListPriceSchema).min(1),
});

export const createPriceListSchema = priceListMutationSchema.extend({
  id: nullableText(120).optional(),
});

export const updatePriceListSchema = priceListMutationSchema.extend({
  id: requiredText(120),
});

export const recommendationMutationSchema = z.object({
  customerId: requiredText(120),
  productId: requiredText(120),
  reason: nullableText(500),
  isActive: z.boolean(),
});

export const createRecommendationSchema = recommendationMutationSchema;

export const updateRecommendationSchema = recommendationMutationSchema.extend({
  id: requiredText(120),
});

export const manualOrderItemSchema = z.object({
  productId: requiredText(120),
  quantity: z.coerce.number().int().positive(),
});

export const manualOrderMutationSchema = z.object({
  customerId: requiredText(120),
  items: z.array(manualOrderItemSchema).min(1),
  notes: nullableText(1000).default(null),
  internalNote: nullableText(1000).default(null),
  intakeChannel: z.enum(intakeChannels),
});

export type CustomerMutationInput = z.infer<typeof customerMutationSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ProductMutationInput = z.infer<typeof productMutationSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type RouteMutationInput = z.infer<typeof routeMutationSchema>;
export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
export type PromotionMutationInput = z.infer<typeof promotionMutationSchema>;
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;
export type PriceListMutationInput = z.infer<typeof priceListMutationSchema>;
export type CreatePriceListInput = z.infer<typeof createPriceListSchema>;
export type UpdatePriceListInput = z.infer<typeof updatePriceListSchema>;
export type RecommendationMutationInput = z.infer<typeof recommendationMutationSchema>;
export type CreateRecommendationInput = z.infer<typeof createRecommendationSchema>;
export type UpdateRecommendationInput = z.infer<typeof updateRecommendationSchema>;
export type ManualOrderMutationInput = z.infer<typeof manualOrderMutationSchema>;
