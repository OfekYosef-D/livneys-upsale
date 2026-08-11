import { createHash } from 'node:crypto';
import { assertNoActiveOrderDuplicates, summarizeActiveOrderDuplicates } from '../features/deployment/order-integrity-audit';
import { prisma } from '../lib/db';

async function main() {
  const includeOrders = process.argv.includes('--orders');
  const includeOrderNetSnapshots = includeOrders || process.argv.includes('--orders-net');
  const assertOrderIntegrity = process.argv.includes('--assert-order-integrity');
  const [products, priceLists, priceListItems] = await Promise.all([
    prisma.product.findMany({ orderBy: { id: 'asc' } }),
    prisma.priceList.findMany({ orderBy: { id: 'asc' } }),
    prisma.priceListItem.findMany({ orderBy: [{ priceListId: 'asc' }, { productId: 'asc' }] }),
  ]);
  const orders = includeOrders
    ? await prisma.order.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        orderNumber: true,
        source: true,
        subtotal: true,
        discountTotal: true,
        paymentDiscountTotal: true,
        total: true,
        vatRatePercent: true,
        vatTotal: true,
        totalIncludingVat: true,
        commercialTermsVersion: true,
        commercialTermsAcceptedAt: true,
        createdAt: true,
      },
    })
    : null;
  const orderNetSnapshots = includeOrderNetSnapshots
    ? await prisma.order.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        orderNumber: true,
        source: true,
        subtotal: true,
        discountTotal: true,
        paymentTerm: true,
        paymentDiscountPercent: true,
        paymentDiscountTotal: true,
        total: true,
        createdAt: true,
      },
    })
    : null;
  const orderIdentitySnapshots = await prisma.order.findMany({
    orderBy: [{ customerId: 'asc' }, { deliveryWindowStart: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      deliveryWindowStart: true,
      status: true,
    },
  });
  const activeOrderDuplicates = summarizeActiveOrderDuplicates(orderIdentitySnapshots);

  console.log(JSON.stringify({
    products: summarize(products),
    priceLists: summarize(priceLists),
    priceListItems: summarize(priceListItems),
    ...(orderNetSnapshots ? { orderNetSnapshots: summarize(orderNetSnapshots) } : {}),
    ...(orders ? { orders: summarize(orders) } : {}),
    ...(orders ? { orderFinancialIntegrity: summarizeOrderFinancialIntegrity(orders) } : {}),
    orderIdentitySnapshots: summarize(orderIdentitySnapshots),
    activeOrderDuplicates,
  }, null, 2));

  if (assertOrderIntegrity) {
    assertNoActiveOrderDuplicates(activeOrderDuplicates);
  }
}

function summarizeOrderFinancialIntegrity(orders: Array<{
  source: string;
  total: unknown;
  vatRatePercent: unknown;
  vatTotal: unknown;
  totalIncludingVat: unknown;
  commercialTermsAcceptedAt: Date | null;
}>) {
  const invalidVatCount = orders.filter((order) => {
    const total = Number(order.total);
    const expectedVat = roundCurrency(total * (Number(order.vatRatePercent) / 100));
    return Number(order.vatTotal) !== expectedVat || Number(order.totalIncludingVat) !== roundCurrency(total + expectedVat);
  }).length;

  return {
    invalidVatCount,
    customerAcceptedCount: orders.filter((order) => order.source === 'CUSTOMER' && order.commercialTermsAcceptedAt).length,
    historicalCustomerCount: orders.filter((order) => order.source === 'CUSTOMER' && !order.commercialTermsAcceptedAt).length,
    manualOrderCount: orders.filter((order) => order.source === 'ADMIN').length,
  };
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function summarize(value: unknown[]) {
  const canonical = canonicalize(JSON.parse(JSON.stringify(value)));

  return {
    count: value.length,
    sha256: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }

  return value;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Critical-data audit failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
