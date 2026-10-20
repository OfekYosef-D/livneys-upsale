import { PrismaClient, type OrderStatus, type PromotionEffectType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import customers from '../data/customers.json';
import orders from '../data/orders.json';
import products from '../data/products.json';
import promotions from '../data/promotions.json';
import routes from '../data/routes.json';
import { calculateOrderTotals } from '../features/orders/totals';
import { priceLine, summarizeLines } from '../features/pricing/engine';
import { buildRouteAnchor } from '../features/routes/schedule';
import { defaultInstitutionalRouteNames, productPricePresets } from '../features/owner-rules/constants';
import { assertDemoSeedAllowed } from '../features/deployment/database-safety';

const prisma = new PrismaClient();

const adminEmail = 'admin@example.com';
const adminPassword = 'livneys-admin';
const customerPassword = 'livneys-demo';

const customerEmails: Record<string, string> = {
  'cust-001': 'south@example.com',
  'cust-002': 'center@example.com',
  'cust-003': 'north@example.com',
  'cust-004': 'cafe-south@example.com',
};

/** Demo routes follow the same weekday rules as real ones (Sunday = 0); dates are computed from them. */
const routeRules: Record<string, { deliveryWeekday: number; cutoffWeekday: number }> = {
  'route-south': { deliveryWeekday: 2, cutoffWeekday: 0 },
  'route-center': { deliveryWeekday: 4, cutoffWeekday: 2 },
  'route-north': { deliveryWeekday: 3, cutoffWeekday: 1 },
};

function routeWindow(routeId: string) {
  const rules = routeRules[routeId] ?? routeRules['route-south'];
  const anchor = buildRouteAnchor({ ...rules, cutoffTime: '18:00' });
  return { ...rules, delivery: anchor.nextDeliveryAt, cutoff: anchor.nextCutoffAt };
}

const ownerRoutes = defaultInstitutionalRouteNames.map((name, index) => ({
  id: `route-owner-${index + 1}`,
  name,
  driver: null,
}));

const herbProductIds = new Set(['prod-olive-spread', 'prod-herbs-spread']);
const spreadPreset = productPricePresets.find((preset) => preset.id === 'spread-185')!;
const herbPreset = productPricePresets.find((preset) => preset.id === 'herb-185')!;

async function resetDemoData() {
  await prisma.whatsAppWebhookEvent.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.notificationJob.deleteMany();
  await prisma.reminderJob.deleteMany();
  await prisma.reminderRule.deleteMany();
  await prisma.customerContactLog.deleteMany();
  await prisma.companyRegistrationRequest.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.customerProductRecommendation.deleteMany();
  await prisma.promotion.deleteMany();
  // Local development only: CASCADE also clears immutable legal, audit, and receipt rows.
  // assertDemoSeedAllowed() makes this path unavailable for Production and Neon databases.
  await prisma.$executeRaw`
    TRUNCATE TABLE
      "Order",
      "User",
      "Customer",
      "PriceList",
      "Product",
      "Route"
    RESTART IDENTITY CASCADE
  `;
}

function normalizeOrderStatus(status: string, orderId: string): OrderStatus {
  if (status.includes('טיוט') || orderId === 'ord-1004') return 'DRAFT';
  if (status.includes('סופק') || orderId === 'ord-1001' || orderId === 'ord-1003') return 'DELIVERED';
  if (status.includes('מאושר') || orderId === 'ord-1005') return 'APPROVED';
  if (status.includes('ארוז')) return 'PACKED';
  if (status.includes('בקשה מיוחדת')) return 'SPECIAL_REQUEST';
  return 'SUBMITTED';
}

function getSeedPromotionEffect(promotionId: string): {
  effectType: PromotionEffectType;
  discountValue?: number;
  buyQuantity?: number;
  freeQuantity?: number;
  priority: number;
} {
  if (promotionId === 'promo-week') {
    return {
      effectType: 'BUY_X_GET_Y',
      buyQuantity: 12,
      freeQuantity: 2,
      priority: 20,
    };
  }

  if (promotionId === 'promo-tasting') {
    return {
      effectType: 'FIXED_UNIT_PRICE',
      discountValue: 99,
      priority: 10,
    };
  }

  return {
    effectType: 'DISPLAY_ONLY',
    priority: 0,
  };
}

function getInstitutionalProductPreset(product: (typeof products)[number]) {
  if (herbProductIds.has(product.id)) return herbPreset;
  if (String(product.unit).includes('500')) return product.name.includes('זעתר') || product.name.includes('טימין') ? productPricePresets.find((preset) => preset.id === 'herb-institutional-500')! : productPricePresets.find((preset) => preset.id === 'institutional-500')!;
  if (String(product.unit).includes('185') || String(product.unit).includes('210')) return spreadPreset;
  return null;
}

function getSeedProductPrice(product: (typeof products)[number]): number {
  return getInstitutionalProductPreset(product)?.price ?? product.price;
}

function getSeedProductOrderMultiple(product: (typeof products)[number]): number {
  return getInstitutionalProductPreset(product)?.orderMultiple ?? product.minQty ?? 1;
}

async function seedProductsAndPricing() {
  await prisma.priceList.createMany({
    data: [
      {
        id: 'price-list-standard',
        name: 'מחירון מוסדי סטנדרטי',
        description: 'מחירי בסיס ללקוחות מוסדיים',
        isDefault: true,
      },
      {
        id: 'price-list-south',
        name: 'מחירון דרום',
        description: 'מחירון דמו ללקוחות קו דרום',
        isDefault: false,
      },
    ],
  });

  for (const product of products) {
    const institutionalPrice = getSeedProductPrice(product);

    await prisma.product.create({
      data: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        basePrice: institutionalPrice,
        unit: product.unit,
        caseSize: product.caseSize,
        minQty: product.minQty ?? 1,
        orderMultiple: getSeedProductOrderMultiple(product),
        assetImage: product.assetImage,
        imageUrl: null,
        stockLabel: product.stockLabel ?? null,
        description: product.description ?? null,
        isActive: true,
      },
    });

    // Questionnaire: same opening price for every institutional customer.
    await prisma.priceListItem.createMany({
      data: [
        {
          priceListId: 'price-list-standard',
          productId: product.id,
          price: institutionalPrice,
        },
        {
          priceListId: 'price-list-south',
          productId: product.id,
          price: institutionalPrice,
        },
      ],
    });
  }
}

async function seedRoutesCustomersAndUsers() {
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 12);
  const hashedCustomerPassword = await bcrypt.hash(customerPassword, 12);

  for (const route of [...routes, ...ownerRoutes]) {
    const window = routeWindow(route.id);

    await prisma.route.create({
      data: {
        id: route.id,
        name: route.name,
        region: route.name,
        driver: route.driver,
        opsContactName: 'צוות ההזמנות',
        opsContactPhone: '050-000-0000',
        deliveryWeekday: window.deliveryWeekday,
        cutoffWeekday: window.cutoffWeekday,
        cutoffTime: '18:00',
        nextDeliveryAt: window.delivery,
        nextCutoffAt: window.cutoff,
        isActive: true,
      },
    });
  }

  await prisma.user.create({
    data: {
      email: adminEmail,
      name: 'Livney Admin',
      passwordHash: hashedAdminPassword,
      role: 'ADMIN',
    },
  });

  for (const customer of customers) {
    const email = customerEmails[customer.id] ?? `${customer.id}@example.com`;

    await prisma.customer.create({
      data: {
        id: customer.id,
        name: customer.name,
        invoiceName: customer.name,
        contact: customer.contact,
        email,
        phone: customer.phone,
        businessType: customer.id === 'cust-003' ? 'יקבים' : 'מעדניות',
        region: customer.region,
        address: customer.address,
        deliveryConstraints: null,
        notes: customer.notes,
        statusLabel: customer.status,
        routeId: customer.routeId,
        priceListId: customer.routeId === 'route-south' ? 'price-list-south' : 'price-list-standard',
        notificationPreference: {
          create: {
            emailEnabled: true,
            whatsappEnabled: customer.id === 'cust-003',
          },
        },
      },
    });

    await prisma.user.create({
      data: {
        email,
        name: customer.contact,
        passwordHash: hashedCustomerPassword,
        role: 'CUSTOMER',
        customerId: customer.id,
      },
    });
  }
}

async function seedPromotionsRecommendationsAndOrders() {
  for (const promotion of promotions) {
    const effect = getSeedPromotionEffect(promotion.id);

    await prisma.promotion.create({
      data: {
        id: promotion.id,
        title: promotion.title,
        tag: promotion.tag,
        description: promotion.description,
        productId: promotion.productId,
        ...effect,
        isActive: true,
        productTargets: {
          create: {
            productId: promotion.productId,
          },
        },
      },
    });
  }

  const recommendedProducts = products.filter((product) => product.isRecommended || product.recommended).slice(0, 8);

  for (const customer of customers) {
    for (const product of recommendedProducts) {
      await prisma.customerProductRecommendation.create({
        data: {
          customerId: customer.id,
          productId: product.id,
          reason: 'מוצר מומלץ להגדלת הזמנה חוזרת',
          isActive: true,
        },
      });
    }
  }

  for (const order of orders) {
    const customer = customers.find((item) => item.id === order.customerId);
    if (!customer) continue;

    const window = routeWindow(customer.routeId);
    const lines = order.items.flatMap((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      return product
        ? [priceLine({ productId: product.id, productName: product.name, listUnitPrice: getSeedProductPrice(product), quantity: item.qty, promotion: null })]
        : [];
    });
    const totals = calculateOrderTotals({ ...summarizeLines(lines), paymentTerm: 'NET_30', vatRatePercent: 18 });
    const status = normalizeOrderStatus(order.status, order.id);
    const orderDate = new Date(`${order.date}T09:00:00.000Z`);

    await prisma.order.create({
      data: {
        id: order.id,
        customerId: order.customerId,
        routeId: customer.routeId,
        status,
        source: 'CUSTOMER',
        deliveryWindowStart: status === 'DRAFT' ? window.delivery : orderDate,
        deadlineAt: window.cutoff,
        submittedAt: status === 'DRAFT' ? null : orderDate,
        ...totals,
        lines: {
          create: lines.map((line) => ({
            productId: line.productId,
            productName: line.productName,
            quantity: line.quantity,
            listUnitPrice: line.listUnitPrice,
            unitPrice: line.unitPrice,
            lineSubtotal: line.lineSubtotal,
            discountTotal: line.discountTotal,
            lineTotal: line.lineTotal,
            promotionId: line.promotionId ?? undefined,
            promotionSnapshot: line.promotionSnapshot ?? undefined,
          })),
        },
      },
    });
  }
}

/** One weekly email reminder for every route, two days before delivery (processed by the daily cron). */
async function seedReminderRule() {
  await prisma.reminderRule.create({
    data: { routeId: null, name: 'תזכורת שבועית – יומיים לפני החלוקה', hoursBeforeDelivery: 48, channel: 'EMAIL', isActive: true },
  });
}

async function main() {
  assertDemoSeedAllowed({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    allowDestructiveDemoSeed: process.env.ALLOW_DESTRUCTIVE_DEMO_SEED,
  });
  await resetDemoData();
  await seedProductsAndPricing();
  await seedRoutesCustomersAndUsers();
  await seedPromotionsRecommendationsAndOrders();
  await seedReminderRule();

  console.log('Seed complete.');
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`Customer: ${customerEmails['cust-001']} / ${customerPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
