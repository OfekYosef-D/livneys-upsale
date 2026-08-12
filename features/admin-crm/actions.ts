'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { createSubmittedOrder } from '@/features/orders/service';
import { assertOrderCanBePacked } from '../order-additions/business-rules';
import { packOrderSafely } from '../order-additions/persistence';
import { assertOrderStatusTransition, orderStatusValues, type OrderStatus } from '@/features/orders/utils';
import { formatManualOrderInternalNote } from '@/features/orders/write';
import { actionError, actionOk, SafeActionError, type ActionResult } from '@/lib/action-result';
import { assertAdminAction } from '@/lib/authorization';
import { prisma } from '@/lib/db';
import { enqueueOrderLifecycleWhatsApp } from '../notifications/jobs';
import { getTemplateKeyForOrderStatus } from '../notifications/templates';
import { revokeCustomerSessionsOnDeactivation } from './customer-access';
import { syncCustomerLoginIdentity } from './customer-login-sync';
import { lockCustomerAccessState } from '../auth/customer-access-lock';
import { appendAuditLog } from '../audit/log';
import {
  createCustomerSchema,
  createPriceListSchema,
  createProductSchema,
  createPromotionSchema,
  createRecommendationSchema,
  createRouteSchema,
  manualOrderMutationSchema,
  updateCustomerSchema,
  updatePriceListSchema,
  updateProductSchema,
  updatePromotionSchema,
  updateRecommendationSchema,
  updateRouteSchema,
} from './schemas';

const activeToggleSchema = z.object({
  id: z.string().trim().min(1),
  isActive: z.boolean(),
});

const clonePriceListSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160),
});

const orderStatusMutationSchema = z.object({
  orderId: z.string().trim().min(1),
  status: z.enum(orderStatusValues),
});

export async function createCustomerAction(input: unknown): Promise<ActionResult<{ customerId: string }>> {
  try {
    const parsed = createCustomerSchema.parse(input);
    const session = await assertAdminAction();
    await assertRouteAndPriceList(parsed.routeId, parsed.priceListId, true);

    const customerId = parsed.id ?? createEntityId('cust', parsed.name);

    await prisma.$transaction(async (tx) => {
      await tx.customer.create({
        data: {
          id: customerId,
          name: parsed.name,
          invoiceName: parsed.invoiceName,
          contact: parsed.contact,
          email: parsed.email,
          phone: parsed.phone,
          accountingContactName: parsed.accountingContactName,
          accountingEmail: parsed.accountingEmail,
          accountingPhone: parsed.accountingPhone,
          businessType: parsed.businessType,
          region: parsed.region,
          address: parsed.address,
          deliveryConstraints: parsed.deliveryConstraints,
          routeId: parsed.routeId,
          priceListId: parsed.priceListId,
          notes: parsed.notes,
          statusLabel: parsed.statusLabel,
          isActive: parsed.isActive,
          notificationPreference: {
            create: {
              emailEnabled: parsed.emailEnabled,
              whatsappEnabled: parsed.whatsappEnabled,
            },
          },
        },
      });
      await appendAuditLog(tx, {
        actorUserId: session.user.id,
        actorRole: 'ADMIN',
        customerId,
        entityType: 'Customer',
        entityId: customerId,
        action: 'CUSTOMER_CREATED',
        requestId: randomUUID(),
        after: parsed,
      });
    });

    revalidateAdminCrm();
    revalidatePath(`/admin/customers/${customerId}`);
    return actionOk({ customerId });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateCustomerAction(input: unknown): Promise<ActionResult<{ customerId: string }>> {
  try {
    const parsed = updateCustomerSchema.parse(input);
    const session = await assertAdminAction();
    await assertRouteAndPriceList(parsed.routeId, parsed.priceListId, true);

    await prisma.$transaction(async (tx) => {
      const lockedCustomer = await lockCustomerAccessState(tx, parsed.id);
      if (!lockedCustomer) throw new SafeActionError('NOT_FOUND', 'הלקוח לא נמצא.');

      const existing = await tx.customer.findUnique({
        where: { id: parsed.id },
        include: { users: true },
      });

      if (!existing) {
        throw new SafeActionError('NOT_FOUND', 'הלקוח לא נמצא.');
      }

      await syncCustomerLoginIdentity(tx, {
        currentEmail: existing.email,
        nextEmail: parsed.email,
        nextContactName: parsed.contact,
        users: existing.users,
        now: new Date(),
      });

      await tx.customer.update({
        where: { id: parsed.id },
        data: {
          name: parsed.name,
          invoiceName: parsed.invoiceName,
          contact: parsed.contact,
          email: parsed.email,
          phone: parsed.phone,
          accountingContactName: parsed.accountingContactName,
          accountingEmail: parsed.accountingEmail,
          accountingPhone: parsed.accountingPhone,
          businessType: parsed.businessType,
          region: parsed.region,
          address: parsed.address,
          deliveryConstraints: parsed.deliveryConstraints,
          routeId: parsed.routeId,
          priceListId: parsed.priceListId,
          notes: parsed.notes,
          statusLabel: parsed.statusLabel,
          isActive: parsed.isActive,
          notificationPreference: {
            upsert: {
              create: {
                emailEnabled: parsed.emailEnabled,
                whatsappEnabled: parsed.whatsappEnabled,
              },
              update: {
                emailEnabled: parsed.emailEnabled,
                whatsappEnabled: parsed.whatsappEnabled,
              },
            },
          },
        },
      });
      await revokeCustomerSessionsOnDeactivation(tx, {
        customerId: parsed.id,
        wasActive: existing.isActive,
        isActive: parsed.isActive,
        now: new Date(),
      });
      await appendAuditLog(tx, {
        actorUserId: session.user.id,
        actorRole: 'ADMIN',
        customerId: parsed.id,
        entityType: 'Customer',
        entityId: parsed.id,
        action: 'CUSTOMER_UPDATED',
        requestId: randomUUID(),
        before: existing,
        after: parsed,
      });
    });

    revalidateAdminCrm();
    revalidatePath(`/admin/customers/${parsed.id}`);
    return actionOk({ customerId: parsed.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleCustomerActiveAction(input: { id: string; isActive: boolean }): Promise<ActionResult<{ customerId: string }>> {
  try {
    const parsed = activeToggleSchema.parse(input);
    const session = await assertAdminAction();
    await prisma.$transaction(async (tx) => {
      const existing = await lockCustomerAccessState(tx, parsed.id);
      if (!existing) throw new SafeActionError('NOT_FOUND', 'הלקוח לא נמצא.');

      await tx.customer.update({
        where: { id: parsed.id },
        data: { isActive: parsed.isActive },
      });
      await revokeCustomerSessionsOnDeactivation(tx, {
        customerId: parsed.id,
        wasActive: existing.isActive,
        isActive: parsed.isActive,
        now: new Date(),
      });
      await appendAuditLog(tx, {
        actorUserId: session.user.id,
        actorRole: 'ADMIN',
        customerId: parsed.id,
        entityType: 'Customer',
        entityId: parsed.id,
        action: parsed.isActive ? 'CUSTOMER_ACTIVATED' : 'CUSTOMER_DEACTIVATED',
        requestId: randomUUID(),
        before: { isActive: existing.isActive },
        after: { isActive: parsed.isActive },
      });
    });

    revalidateAdminCrm();
    revalidatePath(`/admin/customers/${parsed.id}`);
    return actionOk({ customerId: parsed.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function createPriceListAction(input: unknown): Promise<ActionResult<{ priceListId: string }>> {
  try {
    const parsed = createPriceListSchema.parse(input);
    const session = await assertAdminAction();
    await assertProductsExist(parsed.prices.map((item) => item.productId));
    const priceListId = parsed.id ?? createEntityId('price-list', parsed.name);

    await prisma.$transaction(async (tx) => {
      if (parsed.isDefault) {
        await tx.priceList.updateMany({ data: { isDefault: false } });
      }

      await tx.priceList.create({
        data: {
          id: priceListId,
          name: parsed.name,
          description: parsed.description,
          isDefault: parsed.isDefault,
          items: {
            create: parsed.prices.map((item) => ({
              productId: item.productId,
              price: item.price,
            })),
          },
        },
      });
      await appendAuditLog(tx, {
        actorUserId: session.user.id,
        actorRole: 'ADMIN',
        entityType: 'PriceList',
        entityId: priceListId,
        action: 'PRICE_LIST_CREATED',
        requestId: randomUUID(),
        after: parsed,
      });
    });

    revalidateAdminCrm();
    revalidateCustomerCatalogs();
    return actionOk({ priceListId });
  } catch (error) {
    return actionError(error);
  }
}

export async function updatePriceListAction(input: unknown): Promise<ActionResult<{ priceListId: string }>> {
  try {
    const parsed = updatePriceListSchema.parse(input);
    const session = await assertAdminAction();
    await assertProductsExist(parsed.prices.map((item) => item.productId));

    await prisma.$transaction(async (tx) => {
      const existing = await tx.priceList.findUnique({
        where: { id: parsed.id },
        include: { items: true },
      });
      if (!existing) {
        throw new SafeActionError('NOT_FOUND', 'המחירון לא נמצא.');
      }

      if (parsed.isDefault) {
        await tx.priceList.updateMany({
          where: { id: { not: parsed.id } },
          data: { isDefault: false },
        });
      }

      await tx.priceList.update({
        where: { id: parsed.id },
        data: {
          name: parsed.name,
          description: parsed.description,
          isDefault: parsed.isDefault,
        },
      });

      for (const item of parsed.prices) {
        await tx.priceListItem.upsert({
          where: {
            priceListId_productId: {
              priceListId: parsed.id,
              productId: item.productId,
            },
          },
          create: {
            priceListId: parsed.id,
            productId: item.productId,
            price: item.price,
          },
          update: {
            price: item.price,
          },
        });
      }
      await appendAuditLog(tx, {
        actorUserId: session.user.id,
        actorRole: 'ADMIN',
        entityType: 'PriceList',
        entityId: parsed.id,
        action: 'PRICE_LIST_UPDATED',
        requestId: randomUUID(),
        before: {
          ...existing,
          prices: existing.items.map((item) => ({ productId: item.productId, price: item.price })),
        },
        after: parsed,
      });
    });

    revalidateAdminCrm();
    revalidateCustomerCatalogs();
    return actionOk({ priceListId: parsed.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function clonePriceListAction(input: unknown): Promise<ActionResult<{ priceListId: string }>> {
  try {
    const parsed = clonePriceListSchema.parse(input);
    const session = await assertAdminAction();

    const source = await prisma.priceList.findUnique({
      where: { id: parsed.id },
      include: { items: true },
    });

    if (!source) {
      throw new SafeActionError('NOT_FOUND', 'המחירון לא נמצא.');
    }

    const priceListId = createEntityId('price-list', parsed.name);
    await prisma.$transaction(async (tx) => {
      await tx.priceList.create({
        data: {
          id: priceListId,
          name: parsed.name,
          description: source.description,
          isDefault: false,
          items: {
            create: source.items.map((item) => ({
              productId: item.productId,
              price: item.price,
            })),
          },
        },
      });
      await appendAuditLog(tx, {
        actorUserId: session.user.id,
        actorRole: 'ADMIN',
        entityType: 'PriceList',
        entityId: priceListId,
        action: 'PRICE_LIST_CLONED',
        requestId: randomUUID(),
        after: { sourcePriceListId: source.id, name: parsed.name },
      });
    });

    revalidateAdminCrm();
    return actionOk({ priceListId });
  } catch (error) {
    return actionError(error);
  }
}

export async function createProductAction(input: unknown): Promise<ActionResult<{ productId: string }>> {
  try {
    const parsed = createProductSchema.parse(input);
    const session = await assertAdminAction();
    await assertPriceListsExist(parsed.prices.map((item) => item.priceListId));

    const productId = parsed.id ?? createEntityId('prod', parsed.sku);

    await prisma.$transaction(async (tx) => {
      await tx.product.create({
        data: {
          id: productId,
          sku: parsed.sku,
          name: parsed.name,
          category: parsed.category,
          description: parsed.description,
          basePrice: parsed.basePrice,
          unit: parsed.unit,
          caseSize: parsed.caseSize,
          minQty: parsed.minQty,
          orderMultiple: parsed.orderMultiple,
          imageUrl: parsed.imageUrl,
          assetImage: parsed.assetImage,
          stockLabel: parsed.stockLabel,
          isActive: parsed.isActive,
        },
      });

      if (parsed.prices.length > 0) {
        await tx.priceListItem.createMany({
          data: parsed.prices.map((item) => ({
            priceListId: item.priceListId,
            productId,
            price: item.price,
          })),
        });
      } else {
        const defaultPriceList = await tx.priceList.findFirst({
          where: { isDefault: true },
        });

        if (defaultPriceList) {
          await tx.priceListItem.create({
            data: {
              priceListId: defaultPriceList.id,
              productId,
              price: parsed.basePrice,
            },
          });
        }
      }
      await appendAuditLog(tx, {
        actorUserId: session.user.id,
        actorRole: 'ADMIN',
        entityType: 'Product',
        entityId: productId,
        action: 'PRODUCT_CREATED',
        requestId: randomUUID(),
        after: parsed,
      });
    });

    revalidateAdminCrm();
    revalidateCustomerCatalogs();
    return actionOk({ productId });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateProductAction(input: unknown): Promise<ActionResult<{ productId: string }>> {
  try {
    const parsed = updateProductSchema.parse(input);
    const session = await assertAdminAction();
    await assertPriceListsExist(parsed.prices.map((item) => item.priceListId));

    await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id: parsed.id } });
      if (!existing) throw new SafeActionError('NOT_FOUND', 'המוצר לא נמצא.');
      await tx.product.update({
        where: { id: parsed.id },
        data: {
          sku: parsed.sku,
          name: parsed.name,
          category: parsed.category,
          description: parsed.description,
          basePrice: parsed.basePrice,
          unit: parsed.unit,
          caseSize: parsed.caseSize,
          minQty: parsed.minQty,
          orderMultiple: parsed.orderMultiple,
          imageUrl: parsed.imageUrl,
          assetImage: parsed.assetImage,
          stockLabel: parsed.stockLabel,
          isActive: parsed.isActive,
        },
      });

      if (parsed.prices.length > 0) {
        for (const item of parsed.prices) {
          await tx.priceListItem.upsert({
            where: {
              priceListId_productId: {
                priceListId: item.priceListId,
                productId: parsed.id,
              },
            },
            create: {
              priceListId: item.priceListId,
              productId: parsed.id,
              price: item.price,
            },
            update: {
              price: item.price,
            },
          });
        }
      } else {
        const defaultPriceList = await tx.priceList.findFirst({
          where: { isDefault: true },
        });

        if (defaultPriceList) {
          await tx.priceListItem.upsert({
            where: {
              priceListId_productId: {
                priceListId: defaultPriceList.id,
                productId: parsed.id,
              },
            },
            create: {
              priceListId: defaultPriceList.id,
              productId: parsed.id,
              price: parsed.basePrice,
            },
            update: {
              price: parsed.basePrice,
            },
          });
        }
      }
      await appendAuditLog(tx, {
        actorUserId: session.user.id,
        actorRole: 'ADMIN',
        entityType: 'Product',
        entityId: parsed.id,
        action: 'PRODUCT_UPDATED',
        requestId: randomUUID(),
        before: existing,
        after: parsed,
      });
    });

    revalidateAdminCrm();
    revalidateCustomerCatalogs();
    return actionOk({ productId: parsed.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleProductActiveAction(input: { id: string; isActive: boolean }): Promise<ActionResult<{ productId: string }>> {
  try {
    const parsed = activeToggleSchema.parse(input);
    const session = await assertAdminAction();
    await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id: parsed.id }, select: { isActive: true } });
      if (!existing) throw new SafeActionError('NOT_FOUND', 'המוצר לא נמצא.');
      await tx.product.update({ where: { id: parsed.id }, data: { isActive: parsed.isActive } });
      await appendAuditLog(tx, {
        actorUserId: session.user.id,
        actorRole: 'ADMIN',
        entityType: 'Product',
        entityId: parsed.id,
        action: parsed.isActive ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED',
        requestId: randomUUID(),
        before: existing,
        after: { isActive: parsed.isActive },
      });
    });

    revalidateAdminCrm();
    revalidateCustomerCatalogs();
    return actionOk({ productId: parsed.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function createRouteAction(input: unknown): Promise<ActionResult<{ routeId: string }>> {
  try {
    const parsed = createRouteSchema.parse(input);
    await assertAdminAction();
    const routeId = parsed.id ?? createEntityId('route', parsed.name);

    await prisma.route.create({
      data: {
        id: routeId,
        name: parsed.name,
        region: parsed.region,
        driver: parsed.driver,
        opsContactName: parsed.opsContactName,
        opsContactPhone: parsed.opsContactPhone,
        deliveryWeekday: parsed.deliveryWeekday,
        cutoffWeekday: parsed.cutoffWeekday,
        cutoffTime: parsed.cutoffTime,
        nextDeliveryAt: parsed.nextDeliveryAt,
        nextCutoffAt: parsed.nextCutoffAt,
        isActive: parsed.isActive,
      },
    });

    revalidateAdminCrm();
    revalidatePath(`/admin/routes/${routeId}`);
    return actionOk({ routeId });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateRouteAction(input: unknown): Promise<ActionResult<{ routeId: string }>> {
  try {
    const parsed = updateRouteSchema.parse(input);
    await assertAdminAction();

    await prisma.route.update({
      where: { id: parsed.id },
      data: {
        name: parsed.name,
        region: parsed.region,
        driver: parsed.driver,
        opsContactName: parsed.opsContactName,
        opsContactPhone: parsed.opsContactPhone,
        deliveryWeekday: parsed.deliveryWeekday,
        cutoffWeekday: parsed.cutoffWeekday,
        cutoffTime: parsed.cutoffTime,
        nextDeliveryAt: parsed.nextDeliveryAt,
        nextCutoffAt: parsed.nextCutoffAt,
        isActive: parsed.isActive,
      },
    });

    revalidateAdminCrm();
    revalidatePath(`/admin/routes/${parsed.id}`);
    return actionOk({ routeId: parsed.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleRouteActiveAction(input: { id: string; isActive: boolean }): Promise<ActionResult<{ routeId: string }>> {
  try {
    const parsed = activeToggleSchema.parse(input);
    await assertAdminAction();
    await prisma.route.update({
      where: { id: parsed.id },
      data: { isActive: parsed.isActive },
    });

    revalidateAdminCrm();
    revalidatePath(`/admin/routes/${parsed.id}`);
    return actionOk({ routeId: parsed.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function createPromotionAction(input: unknown): Promise<ActionResult<{ promotionId: string }>> {
  try {
    const parsed = createPromotionSchema.parse(input);
    await assertAdminAction();
    await assertPromotionTargets(parsed);
    const promotionId = parsed.id ?? createEntityId('promo', parsed.title);
    const productIds = normalizePromotionProductIds(parsed.productId, parsed.productIds);

    await prisma.promotion.create({
      data: {
        id: promotionId,
        title: parsed.title,
        tag: parsed.tag,
        description: parsed.description,
        productId: productIds[0] ?? null,
        effectType: parsed.effectType,
        discountValue: parsed.discountValue,
        buyQuantity: parsed.buyQuantity === null ? null : Math.floor(parsed.buyQuantity),
        freeQuantity: parsed.freeQuantity === null ? null : Math.floor(parsed.freeQuantity),
        priority: parsed.priority,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        isActive: parsed.isActive,
        productTargets: {
          create: productIds.map((productId) => ({ productId })),
        },
        categoryTargets: {
          create: parsed.categories.map((category) => ({ category })),
        },
        customerTargets: {
          create: parsed.customerIds.map((customerId) => ({ customerId })),
        },
        routeTargets: {
          create: parsed.routeIds.map((routeId) => ({ routeId })),
        },
        priceListTargets: {
          create: parsed.priceListIds.map((priceListId) => ({ priceListId })),
        },
      },
    });

    revalidateAdminCrm();
    revalidateCustomerCatalogs();
    return actionOk({ promotionId });
  } catch (error) {
    return actionError(error);
  }
}

export async function updatePromotionAction(input: unknown): Promise<ActionResult<{ promotionId: string }>> {
  try {
    const parsed = updatePromotionSchema.parse(input);
    await assertAdminAction();
    await assertPromotionTargets(parsed);
    const productIds = normalizePromotionProductIds(parsed.productId, parsed.productIds);

    await prisma.$transaction(async (tx) => {
      await tx.promotion.update({
        where: { id: parsed.id },
        data: {
          title: parsed.title,
          tag: parsed.tag,
          description: parsed.description,
          productId: productIds[0] ?? null,
          effectType: parsed.effectType,
          discountValue: parsed.discountValue,
          buyQuantity: parsed.buyQuantity === null ? null : Math.floor(parsed.buyQuantity),
          freeQuantity: parsed.freeQuantity === null ? null : Math.floor(parsed.freeQuantity),
          priority: parsed.priority,
          startsAt: parsed.startsAt,
          endsAt: parsed.endsAt,
          isActive: parsed.isActive,
        },
      });

      await Promise.all([
        tx.promotionProductTarget.deleteMany({ where: { promotionId: parsed.id } }),
        tx.promotionCategoryTarget.deleteMany({ where: { promotionId: parsed.id } }),
        tx.promotionCustomerTarget.deleteMany({ where: { promotionId: parsed.id } }),
        tx.promotionRouteTarget.deleteMany({ where: { promotionId: parsed.id } }),
        tx.promotionPriceListTarget.deleteMany({ where: { promotionId: parsed.id } }),
      ]);

      await Promise.all([
        productIds.length > 0 ? tx.promotionProductTarget.createMany({ data: productIds.map((productId) => ({ promotionId: parsed.id, productId })) }) : Promise.resolve(),
        parsed.categories.length > 0 ? tx.promotionCategoryTarget.createMany({ data: parsed.categories.map((category) => ({ promotionId: parsed.id, category })) }) : Promise.resolve(),
        parsed.customerIds.length > 0 ? tx.promotionCustomerTarget.createMany({ data: parsed.customerIds.map((customerId) => ({ promotionId: parsed.id, customerId })) }) : Promise.resolve(),
        parsed.routeIds.length > 0 ? tx.promotionRouteTarget.createMany({ data: parsed.routeIds.map((routeId) => ({ promotionId: parsed.id, routeId })) }) : Promise.resolve(),
        parsed.priceListIds.length > 0 ? tx.promotionPriceListTarget.createMany({ data: parsed.priceListIds.map((priceListId) => ({ promotionId: parsed.id, priceListId })) }) : Promise.resolve(),
      ]);
    });

    revalidateAdminCrm();
    revalidateCustomerCatalogs();
    return actionOk({ promotionId: parsed.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function togglePromotionActiveAction(input: { id: string; isActive: boolean }): Promise<ActionResult<{ promotionId: string }>> {
  try {
    const parsed = activeToggleSchema.parse(input);
    await assertAdminAction();
    await prisma.promotion.update({
      where: { id: parsed.id },
      data: { isActive: parsed.isActive },
    });

    revalidateAdminCrm();
    revalidateCustomerCatalogs();
    return actionOk({ promotionId: parsed.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function createRecommendationAction(input: unknown): Promise<ActionResult<{ recommendationId: string }>> {
  try {
    const parsed = createRecommendationSchema.parse(input);
    await assertAdminAction();
    await assertCustomerAndProduct(parsed.customerId, parsed.productId);

    const recommendation = await prisma.customerProductRecommendation.upsert({
      where: {
        customerId_productId: {
          customerId: parsed.customerId,
          productId: parsed.productId,
        },
      },
      create: {
        customerId: parsed.customerId,
        productId: parsed.productId,
        reason: parsed.reason,
        isActive: parsed.isActive,
      },
      update: {
        reason: parsed.reason,
        isActive: parsed.isActive,
      },
    });

    revalidateAdminCrm();
    revalidatePath(`/admin/customers/${parsed.customerId}`);
    revalidatePath(`/customer/${parsed.customerId}`);
    return actionOk({ recommendationId: recommendation.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateRecommendationAction(input: unknown): Promise<ActionResult<{ recommendationId: string }>> {
  try {
    const parsed = updateRecommendationSchema.parse(input);
    await assertAdminAction();
    await assertCustomerAndProduct(parsed.customerId, parsed.productId);

    await prisma.customerProductRecommendation.update({
      where: { id: parsed.id },
      data: {
        customerId: parsed.customerId,
        productId: parsed.productId,
        reason: parsed.reason,
        isActive: parsed.isActive,
      },
    });

    revalidateAdminCrm();
    revalidatePath(`/admin/customers/${parsed.customerId}`);
    revalidatePath(`/customer/${parsed.customerId}`);
    return actionOk({ recommendationId: parsed.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleRecommendationActiveAction(input: { id: string; isActive: boolean }): Promise<ActionResult<{ recommendationId: string }>> {
  try {
    const parsed = activeToggleSchema.parse(input);
    await assertAdminAction();
    const recommendation = await prisma.customerProductRecommendation.update({
      where: { id: parsed.id },
      data: { isActive: parsed.isActive },
    });

    revalidateAdminCrm();
    revalidatePath(`/admin/customers/${recommendation.customerId}`);
    revalidatePath(`/customer/${recommendation.customerId}`);
    return actionOk({ recommendationId: parsed.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function createManualOrderAction(input: unknown): Promise<ActionResult<{ orderId: string; status: string }>> {
  try {
    const parsed = manualOrderMutationSchema.parse(input);
    const session = await assertAdminAction();

    const internalNote = formatManualOrderInternalNote({
      intakeChannel: parsed.intakeChannel,
      note: parsed.internalNote,
    });
    const order = await createSubmittedOrder({
      customerId: parsed.customerId,
      items: parsed.items,
      source: 'ADMIN',
      idempotencyKey: parsed.idempotencyKey,
      paymentTerm: 'NET_30',
      notes: parsed.notes,
      internalNote,
      actorUserId: session.user.id,
    });

    revalidatePath('/admin');
    revalidatePath('/admin/manual-order');
    revalidatePath(`/admin/orders/${order.orderId}`);
    revalidatePath(`/admin/routes/${order.routeId}`);
    revalidatePath(`/admin/customers/${parsed.customerId}`);
    revalidatePath(`/customer/${parsed.customerId}`);
    if (!order.replayed) {
      await enqueueOrderLifecycleSafely({ orderId: order.orderId });
    }
    return actionOk({ orderId: order.orderId, status: order.status });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateOrderStatusAction(input: unknown): Promise<ActionResult<{ orderId: string; status: OrderStatus }>> {
  try {
    const parsed = orderStatusMutationSchema.parse(input);
    const session = await assertAdminAction();

    const existing = await prisma.order.findUnique({
      where: { id: parsed.orderId },
      select: {
        id: true,
        status: true,
        revision: true,
        customerId: true,
        routeId: true,
        additionRequests: {
          where: { status: 'PENDING' },
          select: { id: true },
        },
      },
    });

    if (!existing) {
      throw new SafeActionError('NOT_FOUND', 'ההזמנה לא נמצאה.');
    }

    const nextStatus = assertOrderStatusTransition(existing.status, parsed.status);
    if (nextStatus === 'PACKED') {
      assertOrderCanBePacked(existing.additionRequests?.length ?? 0);
    }
    const order = await prisma.$transaction(async (tx) => {
      const changed = nextStatus === 'PACKED'
        ? await packOrderSafely(tx, existing.id)
        : await (async () => {
            const updated = await tx.order.updateMany({
              where: { id: existing.id, status: existing.status, revision: existing.revision },
              data: { status: nextStatus, revision: { increment: 1 } },
            });
            if (updated.count !== 1) throw new SafeActionError('STALE_VERSION', 'ההזמנה השתנתה. רעננו את המסך ונסו שוב.');
            return tx.order.findUniqueOrThrow({
              where: { id: existing.id },
              select: { id: true, status: true, customerId: true, routeId: true },
            });
          })();
      await appendAuditLog(tx, {
        actorUserId: session.user.id,
        actorRole: 'ADMIN',
        customerId: existing.customerId,
        entityType: 'Order',
        entityId: existing.id,
        action: 'ORDER_STATUS_CHANGED',
        requestId: randomUUID(),
        before: { status: existing.status },
        after: { status: changed.status },
      });
      return changed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath('/admin');
    revalidatePath(`/admin/orders/${order.id}`);
    revalidatePath(`/admin/customers/${order.customerId}`);
    if (order.routeId) {
      revalidatePath(`/admin/routes/${order.routeId}`);
    }
    revalidatePath(`/customer/${order.customerId}`);
    const templateKey = getTemplateKeyForOrderStatus(order.status);
    if (templateKey) {
      await enqueueOrderLifecycleSafely({ orderId: order.id, templateKey });
    }
    return actionOk({ orderId: order.id, status: order.status });
  } catch (error) {
    return actionError(error);
  }
}

async function assertRouteAndPriceList(routeId: string, priceListId: string, requireActiveRoute: boolean) {
  const [route, priceList] = await Promise.all([
    prisma.route.findUnique({ where: { id: routeId } }),
    prisma.priceList.findUnique({ where: { id: priceListId } }),
  ]);

  if (!route || (requireActiveRoute && !route.isActive)) {
    throw new SafeActionError('NOT_FOUND', 'הקו לא נמצא או אינו פעיל.');
  }

  if (!priceList) {
    throw new SafeActionError('NOT_FOUND', 'המחירון לא נמצא.');
  }
}

async function assertProductExists(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new SafeActionError('NOT_FOUND', 'המוצר לא נמצא.');
  }
}

async function assertProductsExist(productIds: string[]) {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return;

  const count = await prisma.product.count({
    where: { id: { in: uniqueIds } },
  });

  if (count !== uniqueIds.length) {
    throw new SafeActionError('NOT_FOUND', 'חלק מהמוצרים לא נמצאו.');
  }
}

async function assertPriceListsExist(priceListIds: string[]) {
  const uniqueIds = [...new Set(priceListIds)];
  if (uniqueIds.length === 0) return;

  const count = await prisma.priceList.count({
    where: { id: { in: uniqueIds } },
  });

  if (count !== uniqueIds.length) {
    throw new SafeActionError('NOT_FOUND', 'חלק מהמחירונים לא נמצאו.');
  }
}

async function assertPromotionTargets(input: {
  productId?: string | null;
  productIds: string[];
  customerIds: string[];
  routeIds: string[];
  priceListIds: string[];
}) {
  const productIds = normalizePromotionProductIds(input.productId, input.productIds);
  await Promise.all([
    assertProductsExist(productIds),
    assertCustomersExist(input.customerIds),
    assertRoutesExist(input.routeIds),
    assertPriceListsExist(input.priceListIds),
  ]);
}

async function assertCustomersExist(customerIds: string[]) {
  const uniqueIds = [...new Set(customerIds)];
  if (uniqueIds.length === 0) return;

  const count = await prisma.customer.count({
    where: { id: { in: uniqueIds } },
  });

  if (count !== uniqueIds.length) {
    throw new SafeActionError('NOT_FOUND', 'חלק מהלקוחות לא נמצאו.');
  }
}

async function assertRoutesExist(routeIds: string[]) {
  const uniqueIds = [...new Set(routeIds)];
  if (uniqueIds.length === 0) return;

  const count = await prisma.route.count({
    where: { id: { in: uniqueIds } },
  });

  if (count !== uniqueIds.length) {
    throw new SafeActionError('NOT_FOUND', 'חלק מהקווים לא נמצאו.');
  }
}

function normalizePromotionProductIds(productId: string | null | undefined, productIds: string[]): string[] {
  return [...new Set([productId, ...productIds].filter(Boolean) as string[])];
}

async function assertCustomerAndProduct(customerId: string, productId: string) {
  const [customer, product] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.product.findUnique({ where: { id: productId } }),
  ]);

  if (!customer || !customer.isActive) {
    throw new SafeActionError('NOT_FOUND', 'הלקוח לא נמצא או אינו פעיל.');
  }

  if (!product || !product.isActive) {
    throw new SafeActionError('NOT_FOUND', 'המוצר לא נמצא או אינו פעיל.');
  }
}

function createEntityId(prefix: string, seed: string): string {
  const slug = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);

  return `${prefix}-${slug || 'item'}-${Date.now().toString(36)}`;
}

function revalidateAdminCrm() {
  revalidatePath('/admin');
  revalidatePath('/admin/customers');
  revalidatePath('/admin/products');
  revalidatePath('/admin/price-lists');
  revalidatePath('/admin/routes');
  revalidatePath('/admin/promotions');
  revalidatePath('/admin/recommendations');
  revalidatePath('/admin/manual-order');
}

function revalidateCustomerCatalogs() {
  revalidatePath('/customer/[customerId]', 'page');
  revalidatePath('/customer/[customerId]/catalog', 'page');
}

async function enqueueOrderLifecycleSafely(input: Parameters<typeof enqueueOrderLifecycleWhatsApp>[0]) {
  try {
    await enqueueOrderLifecycleWhatsApp(input);
  } catch (error) {
    console.error('Failed to enqueue WhatsApp order lifecycle notification', error);
  }
}
