import type { Prisma } from '@prisma/client';
import { SafeActionError } from '../../lib/safe-action-error';
import type { SubmittedOrderPayload } from './write';

const persistedOrderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  routeId: true,
  customerId: true,
  deliveryWindowStart: true,
  idempotencyKey: true,
  revision: true,
} as const;

type OrderPersistenceClient = {
  order: Pick<
    Prisma.TransactionClient['order'],
    'findUnique' | 'findFirst' | 'create' | 'updateMany' | 'findUniqueOrThrow'
  >;
  orderLine: Pick<Prisma.TransactionClient['orderLine'], 'deleteMany' | 'createMany'>;
};
type PersistedOrder = Prisma.OrderGetPayload<{ select: typeof persistedOrderSelect }>;
type OrderPersistencePayload = Omit<SubmittedOrderPayload, 'order'> & {
  order: Omit<SubmittedOrderPayload['order'], 'submittedAt'> & { submittedAt: Date | null };
};

export class ActiveOrderExistsError extends SafeActionError {
  constructor(
    readonly orderId: string,
    readonly orderNumber: number,
    readonly status: string,
  ) {
    super(
      'ACTIVE_ORDER_EXISTS',
      'כבר קיימת הזמנה למועד החלוקה הזה.',
      { orderId, orderNumber, status },
    );
    this.name = 'ActiveOrderExistsError';
  }
}

export class StaleOrderWriteError extends SafeActionError {
  constructor() {
    super('STALE_VERSION', 'ההזמנה השתנתה בזמן השליחה. רעננו את המסך ונסו שוב.');
    this.name = 'StaleOrderWriteError';
  }
}

export class IdempotencyKeyConflictError extends SafeActionError {
  constructor() {
    super('IDEMPOTENCY_KEY_CONFLICT', 'לא ניתן להשלים את שליחת ההזמנה. רעננו את המסך ונסו שוב.');
    this.name = 'IdempotencyKeyConflictError';
  }
}

export function isRetryableOrderWriteError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  return error.code === 'P2002' || error.code === 'P2034';
}

export async function persistSubmittedOrder(
  tx: OrderPersistenceClient,
  {
    payload,
    idempotencyKey,
    replaceDraftForDeliveryWindow,
  }: {
    payload: OrderPersistencePayload;
    idempotencyKey: string;
    replaceDraftForDeliveryWindow: boolean;
  },
): Promise<{ order: PersistedOrder; replayed: boolean }> {
  const replayedOrder = await tx.order.findUnique({
    where: { idempotencyKey },
    select: persistedOrderSelect,
  });

  if (replayedOrder) {
    if (
      replayedOrder.customerId !== payload.order.customerId
      || replayedOrder.deliveryWindowStart.getTime() !== payload.order.deliveryWindowStart.getTime()
    ) {
      throw new IdempotencyKeyConflictError();
    }

    return { order: replayedOrder, replayed: true };
  }

  const activeOrder = await tx.order.findFirst({
    where: {
      customerId: payload.order.customerId,
      deliveryWindowStart: payload.order.deliveryWindowStart,
      status: { not: 'CANCELLED' },
    },
    select: persistedOrderSelect,
  });

  if (activeOrder && (!replaceDraftForDeliveryWindow || activeOrder.status !== 'DRAFT')) {
    throw new ActiveOrderExistsError(activeOrder.id, activeOrder.orderNumber, activeOrder.status);
  }

  const lines = payload.lines.map((line) => ({
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    listUnitPrice: line.listUnitPrice,
    unitPrice: line.unitPrice,
    lineSubtotal: line.lineSubtotal,
    discountTotal: line.discountTotal,
    lineTotal: line.lineTotal,
    promotionId: line.promotionId,
    promotionSnapshot: line.promotionSnapshot ?? undefined,
  }));

  if (activeOrder) {
    const update = await tx.order.updateMany({
      where: {
        id: activeOrder.id,
        status: 'DRAFT',
        revision: activeOrder.revision,
      },
      data: {
        ...payload.order,
        idempotencyKey,
        revision: { increment: 1 },
      },
    });

    if (update.count !== 1) {
      throw new StaleOrderWriteError();
    }

    await tx.orderLine.deleteMany({ where: { orderId: activeOrder.id } });
    await tx.orderLine.createMany({
      data: lines.map((line) => ({ ...line, orderId: activeOrder.id })),
    });

    return {
      order: await tx.order.findUniqueOrThrow({
        where: { id: activeOrder.id },
        select: persistedOrderSelect,
      }),
      replayed: false,
    };
  }

  const order = await tx.order.create({
    data: {
      ...payload.order,
      idempotencyKey,
      lines: { create: lines },
    },
    select: persistedOrderSelect,
  });

  return { order, replayed: false };
}

export async function persistDraftOrder(
  tx: OrderPersistenceClient,
  { payload }: { payload: OrderPersistencePayload },
): Promise<{ order: PersistedOrder }> {
  const activeOrder = await tx.order.findFirst({
    where: {
      customerId: payload.order.customerId,
      deliveryWindowStart: payload.order.deliveryWindowStart,
      status: { not: 'CANCELLED' },
    },
    select: persistedOrderSelect,
  });

  if (activeOrder && activeOrder.status !== 'DRAFT') {
    throw new ActiveOrderExistsError(activeOrder.id, activeOrder.orderNumber, activeOrder.status);
  }

  const lines = payload.lines.map((line) => ({
    productId: line.productId,
    productName: line.productName,
    quantity: line.quantity,
    listUnitPrice: line.listUnitPrice,
    unitPrice: line.unitPrice,
    lineSubtotal: line.lineSubtotal,
    discountTotal: line.discountTotal,
    lineTotal: line.lineTotal,
    promotionId: line.promotionId,
    promotionSnapshot: line.promotionSnapshot ?? undefined,
  }));

  if (activeOrder) {
    const update = await tx.order.updateMany({
      where: { id: activeOrder.id, status: 'DRAFT', revision: activeOrder.revision },
      data: {
        ...payload.order,
        idempotencyKey: null,
        revision: { increment: 1 },
      },
    });

    if (update.count !== 1) {
      throw new StaleOrderWriteError();
    }

    await tx.orderLine.deleteMany({ where: { orderId: activeOrder.id } });
    await tx.orderLine.createMany({
      data: lines.map((line) => ({ ...line, orderId: activeOrder.id })),
    });

    return {
      order: await tx.order.findUniqueOrThrow({
        where: { id: activeOrder.id },
        select: persistedOrderSelect,
      }),
    };
  }

  return {
    order: await tx.order.create({
      data: {
        ...payload.order,
        idempotencyKey: null,
        lines: { create: lines },
      },
      select: persistedOrderSelect,
    }),
  };
}

export async function cancelDraftOrder(
  tx: OrderPersistenceClient,
  {
    customerId,
    deliveryWindowStart,
  }: {
    customerId: string;
    deliveryWindowStart: Date;
  },
): Promise<{ orderId: string | null; cancelled: boolean }> {
  const draft = await tx.order.findFirst({
    where: { customerId, deliveryWindowStart, status: 'DRAFT' },
    select: persistedOrderSelect,
  });

  if (!draft) return { orderId: null, cancelled: false };

  const update = await tx.order.updateMany({
    where: { id: draft.id, status: 'DRAFT', revision: draft.revision },
    data: { status: 'CANCELLED', revision: { increment: 1 } },
  });

  return { orderId: draft.id, cancelled: update.count === 1 };
}
