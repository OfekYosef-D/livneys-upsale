import { z } from 'zod';

export const registrationStatuses = ['PENDING', 'CONTACTED', 'CONVERTED', 'ARCHIVED'] as const;

const requiredText = (max: number) => z.string().trim().min(1).max(max);

const nullableText = (max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().max(max).nullable());

const requiredEmail = z.string().trim().toLowerCase().email().max(254);

const nullableEmail = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}, z.string().email().max(254).nullable());

export const companyRegistrationSchema = z.object({
  businessName: requiredText(160),
  invoiceName: nullableText(160),
  contactName: requiredText(120),
  phone: requiredText(40),
  email: requiredEmail,
  accountingContactName: nullableText(120),
  accountingEmail: nullableEmail,
  accountingPhone: nullableText(40),
  businessType: requiredText(80),
  address: requiredText(240),
  deliveryNotes: nullableText(1000),
  openingOrderNotes: nullableText(1000),
});

export const updateRegistrationStatusSchema = z.object({
  id: requiredText(120),
  status: z.enum(registrationStatuses),
  internalNote: nullableText(1000).optional(),
});

export const convertRegistrationSchema = z.object({
  requestId: requiredText(120),
  routeId: requiredText(120),
  priceListId: requiredText(120),
  temporaryPassword: requiredText(80).min(8),
});

export type CompanyRegistrationInput = z.infer<typeof companyRegistrationSchema>;
export type UpdateRegistrationStatusInput = z.infer<typeof updateRegistrationStatusSchema>;
export type ConvertRegistrationInput = z.infer<typeof convertRegistrationSchema>;
