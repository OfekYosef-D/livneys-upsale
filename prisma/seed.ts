import { PrismaClient, type NotificationChannel, type OrderStatus, type PromotionEffectType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import customers from '../data/customers.json';
import orders from '../data/orders.json';
import products from '../data/products.json';
import promotions from '../data/promotions.json';
import routes from '../data/routes.json';
import { createOrderSnapshotLines } from '../features/orders/utils';
import { calculateVatSummary } from '../features/orders/vat';
import { defaultInstitutionalRouteNames, productPricePresets } from '../features/owner-rules/constants';
import { assertDemoSeedAllowed } from '../features/deployment/database-safety';

const prisma = new PrismaClient();

const adminEmail = 'admin@livneys.local';
const adminPassword = 'livneys-admin';
const customerPassword = 'livneys-demo';

const customerEmails: Record<string, string> = {
  'cust-001': 'south@livneys.local',
  'cust-002': 'center@livneys.local',
  'cust-003': 'north@livneys.local',
  'cust-004': 'cafe-south@livneys.local',
};

function futureDate(daysFromToday: number, hourUtc: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromToday, hourUtc, 0, 0));
}

const routeWindows: Record<string, { delivery: Date; cutoff: Date; deliveryWeekday: number; cutoffWeekday: number }> = {
  'route-south': {
    delivery: futureDate(3, 8),
    cutoff: futureDate(2, 15),
    deliveryWeekday: 2,
    cutoffWeekday: 1,
  },
  'route-center': {
    delivery: futureDate(4, 8),
    cutoff: futureDate(3, 15),
    deliveryWeekday: 4,
    cutoffWeekday: 3,
  },
  'route-north': {
    delivery: futureDate(5, 8),
    cutoff: futureDate(4, 15),
    deliveryWeekday: 3,
    cutoffWeekday: 2,
  },
};

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
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.priceListItem.deleteMany();
  await prisma.priceList.deleteMany();
  await prisma.product.deleteMany();
  await prisma.route.deleteMany();
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
          price: Math.max(1, institutionalPrice - (product.recommended ? 1 : 0)),
        },
      ],
    });
  }
}

async function seedRoutesCustomersAndUsers() {
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 12);
  const hashedCustomerPassword = await bcrypt.hash(customerPassword, 12);

  for (const route of [...routes, ...ownerRoutes]) {
    const window = routeWindows[route.id] ?? routeWindows['route-south'];

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
    const email = customerEmails[customer.id] ?? `${customer.id}@livneys.local`;

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

    const routeWindow = routeWindows[customer.routeId] ?? routeWindows['route-south'];
    const snapshotLines = createOrderSnapshotLines({
      items: order.items.map((item) => ({ productId: item.productId, quantity: item.qty })),
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        price: getSeedProductPrice(product),
        minQty: product.minQty ?? 1,
      })),
    });
    const total = snapshotLines.reduce((sum, line) => sum + line.lineTotal, 0);
    const vat = calculateVatSummary(total);
    const status = normalizeOrderStatus(order.status, order.id);
    const orderDate = new Date(`${order.date}T09:00:00.000Z`);

    await prisma.order.create({
      data: {
        id: order.id,
        customerId: order.customerId,
        routeId: customer.routeId,
        status,
        source: 'CUSTOMER',
        deliveryWindowStart: status === 'DRAFT' ? routeWindow.delivery : orderDate,
        deadlineAt: routeWindow.cutoff,
        submittedAt: status === 'DRAFT' ? null : orderDate,
        subtotal: total,
        discountTotal: 0,
        total,
        vatRatePercent: vat.vatRatePercent,
        vatTotal: vat.vatTotal,
        totalIncludingVat: vat.totalIncludingVat,
        lines: {
          create: snapshotLines.map((line) => ({
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

async function seedReminderExamples() {
  const southWindow = routeWindows['route-south'];
  const emailRule = await prisma.reminderRule.create({
    data: {
      routeId: 'route-south',
      name: 'תזכורת 48 שעות לפני חלוקת דרום',
      hoursBeforeDelivery: 48,
      channel: 'EMAIL',
      isActive: true,
    },
  });

  const whatsappRule = await prisma.reminderRule.create({
    data: {
      routeId: 'route-south',
      name: 'WhatsApp ידני ללקוחות שלא הזמינו',
      hoursBeforeDelivery: 48,
      channel: 'WHATSAPP',
      isActive: true,
    },
  });

  await createReminderExample({
    ruleId: emailRule.id,
    customerId: 'cust-001',
    routeId: 'route-south',
    deliveryWindowStart: southWindow.delivery,
    channel: 'EMAIL',
    status: 'PENDING',
    scheduledAt: futureDate(1, 8),
    message: 'תזכורת דמו להזמנה חוזרת עם מוצרים מומלצים.',
  });

  await createReminderExample({
    ruleId: whatsappRule.id,
    customerId: 'cust-004',
    routeId: 'route-south',
    deliveryWindowStart: southWindow.delivery,
    channel: 'WHATSAPP',
    status: 'WHATSAPP_QUEUED',
    scheduledAt: futureDate(1, 8),
    message: 'שלום, קו דרום מתקרב. אפשר להשלים הזמנה חוזרת בקישור.',
    whatsappUrl: 'https://wa.me/972500000000?text=שלום',
  });
}

async function createReminderExample({
  ruleId,
  customerId,
  routeId,
  deliveryWindowStart,
  channel,
  status,
  scheduledAt,
  message,
  whatsappUrl,
}: {
  ruleId: string;
  customerId: string;
  routeId: string;
  deliveryWindowStart: Date;
  channel: NotificationChannel;
  status: 'PENDING' | 'WHATSAPP_QUEUED';
  scheduledAt: Date;
  message: string;
  whatsappUrl?: string;
}) {
  const reminderJob = await prisma.reminderJob.create({
    data: {
      reminderRuleId: ruleId,
      customerId,
      routeId,
      deliveryWindowStart,
      channel,
      status,
      scheduledAt,
      whatsappUrl,
    },
  });
  const notificationJob =
    channel === 'WHATSAPP'
      ? await prisma.notificationJob.create({
          data: {
            customerId,
            reminderJobId: reminderJob.id,
            channel,
            templateKey: 'ORDER_REMINDER',
            templateName: null,
            status: 'DRY_RUN',
            dryRun: true,
            payload: {
              to: '972500000000',
              languageCode: 'he',
              bodyParameters: ['לקוח לדוגמה', 'Livney', 'דרום', '01/07/2026', '30/06/2026, 18:00', 'http://localhost:3000/customer/cust-004'],
            },
            message,
            scheduledAt,
            processedAt: scheduledAt,
            attempts: 1,
            dedupeKey: `seed:reminder:${reminderJob.id}`,
          },
        })
      : null;

  await prisma.notificationEvent.create({
    data: {
      customerId,
      reminderJobId: reminderJob.id,
      notificationJobId: notificationJob?.id,
      channel,
      type: 'REMINDER_EXAMPLE',
      status: status === 'PENDING' ? 'PENDING' : 'SENT',
      subject: channel === 'EMAIL' ? 'תזכורת להזמנה חוזרת' : null,
      message,
    },
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
  await seedReminderExamples();

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
