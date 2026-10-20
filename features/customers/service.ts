import { createEntityId } from '@/lib/ids';
import { NotFoundError } from '@/lib/errors';
import type { TransactionClient } from '@/lib/transactions';

export type CustomerFields = {
  name: string;
  invoiceName: string | null;
  contact: string;
  email: string | null;
  phone: string;
  accountingContactName: string | null;
  accountingEmail: string | null;
  accountingPhone: string | null;
  businessType: string | null;
  region: string;
  address: string;
  deliveryConstraints: string | null;
  routeId: string;
  priceListId: string;
  notes: string | null;
  statusLabel: string | null;
  isActive: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
};

/** A customer must be attached to an active delivery route and an existing price list. */
export async function assertCustomerAssignment(tx: Pick<TransactionClient, 'route' | 'priceList'>, routeId: string, priceListId: string) {
  const [route, priceList] = await Promise.all([
    tx.route.findUnique({ where: { id: routeId }, select: { isActive: true, region: true } }),
    tx.priceList.findUnique({ where: { id: priceListId }, select: { id: true } }),
  ]);
  if (!route?.isActive) throw new NotFoundError('קו החלוקה לא נמצא או אינו פעיל.');
  if (!priceList) throw new NotFoundError('המחירון לא נמצא.');
  return route;
}

/** Single place that creates customers (admin form and self-registration conversion). */
export async function createCustomerRecord(tx: TransactionClient, fields: CustomerFields): Promise<string> {
  await assertCustomerAssignment(tx, fields.routeId, fields.priceListId);
  const { emailEnabled, whatsappEnabled, ...data } = fields;
  const id = createEntityId('cust');
  await tx.customer.create({
    data: { ...data, id, notificationPreference: { create: { emailEnabled, whatsappEnabled } } },
  });
  return id;
}
