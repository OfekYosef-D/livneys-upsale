import { fields, z } from '@/lib/validation';

export const companyRegistrationSchema = z.object({
  businessName: fields.requiredText(160),
  invoiceName: fields.optionalText(160),
  contactName: fields.requiredText(120),
  phone: fields.phone,
  email: fields.email,
  accountingContactName: fields.optionalText(120),
  accountingEmail: fields.optionalEmail,
  accountingPhone: fields.optionalText(40),
  businessType: fields.requiredText(80),
  address: fields.requiredText(240),
  deliveryNotes: fields.optionalText(1000),
  openingOrderNotes: fields.optionalText(1000),
  /** Honeypot: real users never see or fill this field. Checked after rate limiting, with a generic error. */
  website: z.string().max(500).optional().default(''),
  challengeToken: z.string().max(2048).optional().default(''),
});

export const updateRegistrationStatusSchema = z.object({
  id: fields.id,
  status: z.enum(['CONTACTED', 'ARCHIVED', 'PENDING']),
  internalNote: fields.optionalText(1000).optional(),
});

export const convertRegistrationSchema = z.object({
  requestId: fields.id,
  routeId: fields.id,
  priceListId: fields.id,
});
