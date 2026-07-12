import { prisma } from '@/lib/db';

export async function getRegistrationManagementData() {
  const [requests, routes, priceLists] = await Promise.all([
    prisma.companyRegistrationRequest.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.route.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.priceList.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    }),
  ]);

  return {
    requests: requests.map((request) => ({
      id: request.id,
      businessName: request.businessName,
      invoiceName: request.invoiceName,
      contactName: request.contactName,
      phone: request.phone,
      email: request.email,
      accountingContactName: request.accountingContactName,
      accountingEmail: request.accountingEmail,
      accountingPhone: request.accountingPhone,
      businessType: request.businessType,
      address: request.address,
      deliveryNotes: request.deliveryNotes,
      openingOrderNotes: request.openingOrderNotes,
      status: request.status,
      internalNote: request.internalNote,
      convertedCustomerId: request.convertedCustomerId,
      createdAt: request.createdAt.toISOString(),
    })),
    routes: routes.map((route) => ({
      id: route.id,
      name: route.name,
      region: route.region,
    })),
    priceLists: priceLists.map((priceList) => ({
      id: priceList.id,
      name: priceList.name,
      isDefault: priceList.isDefault,
    })),
  };
}
