import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '@/lib/errors';
import { asMock } from '@/test/prisma-mock';

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/authorization', () => ({
  assertAdminAction: vi.fn(),
  assertCustomerAction: vi.fn(),
}));
vi.mock('@/features/notifications/order-notifications', () => ({
  notifyOrderStatusInBackground: vi.fn(),
  notifyAdditionDecisionInBackground: vi.fn(),
}));
vi.mock('@/features/orders/service', () => ({
  submitOrder: vi.fn(),
  changeOrderStatus: vi.fn(),
  saveDraftOrder: vi.fn(),
}));

const { prisma } = await import('@/lib/db');
const db = asMock(prisma);
const { assertAdminAction } = await import('@/lib/authorization');
const { revalidatePath } = await import('next/cache');
const { notifyOrderStatusInBackground } = await import('@/features/notifications/order-notifications');
const { submitOrder, changeOrderStatus } = await import('@/features/orders/service');
const { saveCustomerAction, toggleCustomerActiveAction } = await import('./customers');
const { saveRouteAction, toggleRouteActiveAction } = await import('./routes');
const { savePromotionAction, togglePromotionActiveAction } = await import('./promotions');
const { toggleProductActiveAction, updateProductQuickAction, bulkUpdateCategoryPricesAction } = await import('./products');
const { savePriceListAction } = await import('./price-lists');
const { saveRecommendationAction } = await import('./recommendations');
const { createManualOrderAction, updateOrderStatusAction } = await import('./orders');

const idempotencyKey = '8f82b072-99be-45e7-b1aa-2ca4d92fc8d2';

const customerInput = {
  name: 'Cafe South',
  contact: 'Dana',
  email: 'new@example.com',
  phone: '050-1111111',
  region: 'South',
  address: 'Industrial 4',
  routeId: 'route-south',
  priceListId: 'price-list-standard',
  isActive: true,
  emailEnabled: true,
  whatsappEnabled: false,
};

const routeInput = {
  name: 'South',
  region: 'South',
  deliveryWeekday: 2,
  cutoffWeekday: 1,
  cutoffTime: '18:00',
  nextDeliveryDate: '2026-11-03',
  isActive: true,
};

const promotionInput = {
  title: 'Promo',
  tag: '10%',
  description: 'Percent discount',
  effectType: 'PERCENT_OFF',
  discountValue: 10,
  productIds: [],
  categories: ['ממרחים'],
  customerIds: [],
  routeIds: [],
  priceListIds: [],
  isActive: true,
};

/** Audit rows written through the action context (the real audit writer runs on the Prisma mock). */
function auditEntries() {
  return db.auditLog.create.mock.calls.map(([args]) => (args as { data: Record<string, unknown> }).data);
}

beforeEach(() => {
  vi.clearAllMocks();
  db.$reset();
  vi.mocked(assertAdminAction).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never);
  db.auditLog.create.mockResolvedValue({});
});

describe('authorization', () => {
  it.each([
    ['saveCustomerAction', () => saveCustomerAction(customerInput)],
    ['toggleRouteActiveAction', () => toggleRouteActiveAction({ id: 'route-1', isActive: false })],
    ['createManualOrderAction', () => createManualOrderAction({ customerId: 'cust-1', idempotencyKey, vatRatePercent: 18, intakeChannel: 'PHONE', items: [{ productId: 'p', quantity: 1 }] })],
    ['updateOrderStatusAction', () => updateOrderStatusAction({ orderId: 'ord-1', status: 'APPROVED' })],
  ])('%s returns UNAUTHORIZED without touching the database', async (_name, run) => {
    vi.mocked(assertAdminAction).mockRejectedValue(new AuthorizationError());

    const result = await run();

    expect(result).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(submitOrder).not.toHaveBeenCalled();
    expect(changeOrderStatus).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a validation error for invalid input', async () => {
    const result = await toggleRouteActiveAction({ id: 'route-1', isActive: 'yes' });

    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('saveCustomerAction', () => {
  it('creates a customer with notification preferences and audits CUSTOMER_CREATED', async () => {
    db.route.findUnique.mockResolvedValue({ isActive: true, region: 'South' });
    db.priceList.findUnique.mockResolvedValue({ id: 'price-list-standard' });

    const result = await saveCustomerAction(customerInput);

    expect(result.ok).toBe(true);
    const customerId = result.ok ? result.data.customerId : '';
    expect(customerId).toMatch(/^cust-/);
    expect(db.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: customerId,
        name: 'Cafe South',
        email: 'new@example.com',
        notificationPreference: { create: { emailEnabled: true, whatsappEnabled: false } },
      }),
    });
    expect(auditEntries()).toEqual([expect.objectContaining({
      action: 'CUSTOMER_CREATED',
      entityType: 'Customer',
      entityId: customerId,
      customerId,
      actorUserId: 'u1',
      actorRole: 'ADMIN',
    })]);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('refuses to create a customer on an inactive route', async () => {
    db.route.findUnique.mockResolvedValue({ isActive: false, region: 'South' });
    db.priceList.findUnique.mockResolvedValue({ id: 'price-list-standard' });

    const result = await saveCustomerAction(customerInput);

    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(db.customer.create).not.toHaveBeenCalled();
    expect(auditEntries()).toEqual([]);
  });

  it('moves the login with the email and revokes sessions when the customer is deactivated', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'cust-1', isActive: true }]);
    db.customer.findUnique.mockResolvedValue({
      id: 'cust-1',
      email: 'old@example.com',
      isActive: true,
      users: [{ id: 'user-1', email: 'old@example.com' }],
    });
    db.route.findUnique.mockResolvedValue({ isActive: true, region: 'South' });
    db.priceList.findUnique.mockResolvedValue({ id: 'price-list-standard' });

    const result = await saveCustomerAction({ ...customerInput, id: 'cust-1', isActive: false });

    expect(result).toEqual({ ok: true, data: { customerId: 'cust-1' } });
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { email: 'new@example.com', name: 'Dana' } });
    expect(db.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: expect.objectContaining({
        isActive: false,
        notificationPreference: {
          upsert: { create: { emailEnabled: true, whatsappEnabled: false }, update: { emailEnabled: true, whatsappEnabled: false } },
        },
      }),
    });
    expect(db.user.updateMany).toHaveBeenCalledWith({ where: { customerId: 'cust-1' }, data: { sessionVersion: { increment: 1 } } });
    expect(db.authToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { usedAt: null, user: { customerId: 'cust-1' } } }));
    expect(auditEntries()).toEqual([expect.objectContaining({ action: 'CUSTOMER_UPDATED', entityId: 'cust-1' })]);
  });

  it('does not revoke company sessions when an active customer stays active', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'cust-1', isActive: true }]);
    db.customer.findUnique.mockResolvedValue({ id: 'cust-1', email: 'new@example.com', isActive: true, users: [] });
    db.route.findUnique.mockResolvedValue({ isActive: true, region: 'South' });
    db.priceList.findUnique.mockResolvedValue({ id: 'price-list-standard' });

    const result = await saveCustomerAction({ ...customerInput, id: 'cust-1' });

    expect(result.ok).toBe(true);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the customer row does not exist', async () => {
    db.$queryRaw.mockResolvedValue([]);

    const result = await saveCustomerAction({ ...customerInput, id: 'missing' });

    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(db.customer.update).not.toHaveBeenCalled();
  });
});

describe('toggleCustomerActiveAction', () => {
  it('deactivates the company, revokes its sessions and audits it', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'cust-1', isActive: true }]);

    const result = await toggleCustomerActiveAction({ id: 'cust-1', isActive: false });

    expect(result).toEqual({ ok: true, data: { customerId: 'cust-1' } });
    expect(db.customer.update).toHaveBeenCalledWith({ where: { id: 'cust-1' }, data: { isActive: false } });
    expect(db.user.updateMany).toHaveBeenCalledWith({ where: { customerId: 'cust-1' }, data: { sessionVersion: { increment: 1 } } });
    expect(auditEntries()).toEqual([expect.objectContaining({
      action: 'CUSTOMER_DEACTIVATED',
      before: { isActive: true },
      after: { isActive: false },
    })]);
  });
});

describe('route actions', () => {
  it('creates a route with nextDeliveryAt/nextCutoffAt from the explicit delivery date', async () => {
    const result = await saveRouteAction(routeInput);

    expect(result.ok).toBe(true);
    // 2026-11-03 08:00 and the previous Monday 18:00, Israel standard time (UTC+2).
    expect(db.route.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'South',
        deliveryWeekday: 2,
        nextDeliveryAt: new Date('2026-11-03T06:00:00.000Z'),
        nextCutoffAt: new Date('2026-11-02T16:00:00.000Z'),
        id: expect.stringMatching(/^route-/),
      }),
    });
    expect(auditEntries()).toEqual([expect.objectContaining({ action: 'ROUTE_CREATED', entityType: 'Route' })]);
  });

  it('keeps the existing anchor instant when the delivery date is unchanged', async () => {
    const currentAnchor = new Date('2026-11-03T07:30:00.000Z');
    db.route.findUnique.mockResolvedValue({ id: 'route-1', nextDeliveryAt: currentAnchor });

    const result = await saveRouteAction({ ...routeInput, id: 'route-1' });

    expect(result).toEqual({ ok: true, data: { routeId: 'route-1' } });
    expect(db.route.update).toHaveBeenCalledWith({
      where: { id: 'route-1' },
      data: expect.objectContaining({ nextDeliveryAt: currentAnchor }),
    });
    expect(auditEntries()).toEqual([expect.objectContaining({ action: 'ROUTE_UPDATED', entityId: 'route-1' })]);
  });

  it('returns NOT_FOUND when updating a missing route', async () => {
    db.route.findUnique.mockResolvedValue(null);

    const result = await saveRouteAction({ ...routeInput, id: 'route-x' });

    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(db.route.update).not.toHaveBeenCalled();
  });

  it('audits route activation toggles', async () => {
    db.route.findUnique.mockResolvedValue({ isActive: true });

    const result = await toggleRouteActiveAction({ id: 'route-1', isActive: false });

    expect(result).toEqual({ ok: true, data: { routeId: 'route-1' } });
    expect(db.route.update).toHaveBeenCalledWith({ where: { id: 'route-1' }, data: { isActive: false } });
    expect(auditEntries()).toEqual([expect.objectContaining({
      action: 'ROUTE_DEACTIVATED',
      entityType: 'Route',
      entityId: 'route-1',
      before: { isActive: true },
      after: { isActive: false },
    })]);
  });
});

describe('promotion actions', () => {
  it('audits promotion activation toggles', async () => {
    db.promotion.findUnique.mockResolvedValue({ isActive: false });

    const result = await togglePromotionActiveAction({ id: 'promo-1', isActive: true });

    expect(result).toEqual({ ok: true, data: { promotionId: 'promo-1' } });
    expect(auditEntries()).toEqual([expect.objectContaining({ action: 'PROMOTION_ACTIVATED', entityType: 'Promotion', entityId: 'promo-1' })]);
  });

  it('returns NOT_FOUND when toggling a missing promotion', async () => {
    db.promotion.findUnique.mockResolvedValue(null);

    const result = await togglePromotionActiveAction({ id: 'promo-x', isActive: true });

    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(db.promotion.update).not.toHaveBeenCalled();
  });

  it('creates a promotion, replaces its targets and audits PROMOTION_CREATED', async () => {
    const result = await savePromotionAction(promotionInput);

    expect(result.ok).toBe(true);
    const promotionId = result.ok ? result.data.promotionId : '';
    expect(db.promotion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id: promotionId, productId: null, discountValue: 10 }) });
    expect(db.promotionCategoryTarget.deleteMany).toHaveBeenCalledWith({ where: { promotionId } });
    expect(db.promotionCategoryTarget.createMany).toHaveBeenCalledWith({ data: [{ promotionId, category: 'ממרחים' }] });
    expect(auditEntries()).toEqual([expect.objectContaining({ action: 'PROMOTION_CREATED', entityId: promotionId })]);
  });

  it('rejects targets that do not exist before writing', async () => {
    db.product.count.mockResolvedValue(0);

    const result = await savePromotionAction({ ...promotionInput, productIds: ['prod-missing'] });

    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(db.promotion.create).not.toHaveBeenCalled();
  });
});

describe('product actions', () => {
  it('quick-updates price everywhere and aligns the order multiple with a larger minimum', async () => {
    db.product.findUnique.mockResolvedValue({ basePrice: 10, minQty: 6, orderMultiple: 6 });
    db.priceList.findMany.mockResolvedValue([]);
    db.priceListItem.findMany.mockResolvedValue([]);

    const result = await updateProductQuickAction({ id: 'prod-1', basePrice: 35, minQty: 8 });

    expect(result).toEqual({ ok: true, data: { productId: 'prod-1' } });
    expect(db.product.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['prod-1'] } }, data: { basePrice: 35 } });
    expect(db.product.update).toHaveBeenCalledWith({ where: { id: 'prod-1' }, data: { minQty: 8, orderMultiple: 8 } });
    expect(auditEntries()).toEqual([expect.objectContaining({ action: 'PRODUCT_QUICK_UPDATED', after: { basePrice: 35, minQty: 8 } })]);
  });

  it('refuses a bulk category price when the category has no active products', async () => {
    db.product.findMany.mockResolvedValue([]);

    const result = await bulkUpdateCategoryPricesAction({ category: 'ממרחים', price: 30 });

    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(db.product.updateMany).not.toHaveBeenCalled();
  });

  it('applies a bulk category price and reports the count', async () => {
    db.product.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    db.priceList.findMany.mockResolvedValue([]);
    db.priceListItem.findMany.mockResolvedValue([]);

    const result = await bulkUpdateCategoryPricesAction({ category: 'ממרחים', price: 30 });

    expect(result).toEqual({ ok: true, data: { updatedCount: 2, category: 'ממרחים' } });
    expect(auditEntries()).toEqual([expect.objectContaining({ action: 'PRODUCT_CATEGORY_PRICES_UPDATED' })]);
  });

  it('audits product deactivation', async () => {
    db.product.findUnique.mockResolvedValue({ isActive: true });

    await toggleProductActiveAction({ id: 'prod-1', isActive: false });

    expect(auditEntries()).toEqual([expect.objectContaining({ action: 'PRODUCT_DEACTIVATED', entityId: 'prod-1' })]);
  });
});

describe('price list and recommendation actions', () => {
  it('makes a new default price list the only default', async () => {
    db.product.count.mockResolvedValue(1);

    const result = await savePriceListAction({ name: 'VIP', isDefault: true, prices: [{ productId: 'prod-1', price: 12 }] });

    expect(result.ok).toBe(true);
    const priceListId = result.ok ? result.data.priceListId : '';
    expect(db.priceList.updateMany).toHaveBeenCalledWith({ where: { id: { not: priceListId } }, data: { isDefault: false } });
    expect(db.priceListItem.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { priceListId, productId: 'prod-1', price: 12 } }));
    expect(auditEntries()).toEqual([expect.objectContaining({ action: 'PRICE_LIST_CREATED' })]);
  });

  it('does not recommend inactive products', async () => {
    db.customer.findUnique.mockResolvedValue({ isActive: true });
    db.product.findUnique.mockResolvedValue({ isActive: false });

    const result = await saveRecommendationAction({ customerId: 'cust-1', productId: 'prod-1', isActive: true });

    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(db.customerProductRecommendation.upsert).not.toHaveBeenCalled();
  });
});

describe('order actions', () => {
  it('changes the order status through the order service and notifies the customer', async () => {
    vi.mocked(changeOrderStatus).mockResolvedValue({ orderId: 'ord-1', customerId: 'cust-1', status: 'APPROVED' });

    const result = await updateOrderStatusAction({ orderId: 'ord-1', status: 'APPROVED' });

    expect(result).toEqual({ ok: true, data: { orderId: 'ord-1', customerId: 'cust-1', status: 'APPROVED' } });
    expect(changeOrderStatus).toHaveBeenCalledWith({ orderId: 'ord-1', status: 'APPROVED', audit: expect.any(Function) });
    expect(notifyOrderStatusInBackground).toHaveBeenCalledWith('ord-1');
  });

  it('maps service failures to action errors without notifying', async () => {
    const { AppError } = await import('@/lib/errors');
    vi.mocked(changeOrderStatus).mockRejectedValue(new AppError('ORDER_LOCKED', 'locked'));

    const result = await updateOrderStatusAction({ orderId: 'ord-1', status: 'PACKED' });

    expect(result).toEqual({ ok: false, code: 'ORDER_LOCKED', error: 'locked' });
    expect(notifyOrderStatusInBackground).not.toHaveBeenCalled();
  });

  it('rejects unknown statuses before calling the service', async () => {
    const result = await updateOrderStatusAction({ orderId: 'ord-1', status: 'SHIPPED' });

    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(changeOrderStatus).not.toHaveBeenCalled();
  });

  const manualOrder = {
    customerId: 'cust-001',
    idempotencyKey,
    vatRatePercent: 18,
    intakeChannel: 'PHONE',
    notes: 'Call before delivery',
    internalNote: '  Ordered with Shai ',
    items: [{ productId: 'prod-a', quantity: 3 }],
  };

  it('submits manual orders as ADMIN orders with a tagged internal note and notifies', async () => {
    vi.mocked(submitOrder).mockResolvedValue({ orderId: 'ord-manual', orderNumber: 1002, status: 'SUBMITTED', replayed: false });

    const result = await createManualOrderAction(manualOrder);

    expect(result).toEqual({ ok: true, data: { orderId: 'ord-manual', status: 'SUBMITTED' } });
    expect(submitOrder).toHaveBeenCalledWith({
      customerId: 'cust-001',
      items: [{ productId: 'prod-a', quantity: 3 }],
      source: 'ADMIN',
      idempotencyKey,
      paymentTerm: 'NET_30',
      expectedVatRatePercent: 18,
      notes: 'Call before delivery',
      internalNote: '[manual-order:intake=PHONE] Ordered with Shai',
      actor: { userId: 'u1', audit: expect.any(Function) },
    });
    expect(notifyOrderStatusInBackground).toHaveBeenCalledWith('ord-manual');
  });

  it('tags a manual order without an internal note with the intake channel only', async () => {
    vi.mocked(submitOrder).mockResolvedValue({ orderId: 'ord-manual', orderNumber: 1002, status: 'SUBMITTED', replayed: false });

    await createManualOrderAction({ ...manualOrder, intakeChannel: 'WHATSAPP', internalNote: '' });

    expect(submitOrder).toHaveBeenCalledWith(expect.objectContaining({ internalNote: '[manual-order:intake=WHATSAPP]' }));
  });

  it('does not notify again when a manual order submission is replayed', async () => {
    vi.mocked(submitOrder).mockResolvedValue({ orderId: 'ord-manual', orderNumber: 1002, status: 'SUBMITTED', replayed: true });

    const result = await createManualOrderAction(manualOrder);

    expect(result.ok).toBe(true);
    expect(notifyOrderStatusInBackground).not.toHaveBeenCalled();
  });
});
