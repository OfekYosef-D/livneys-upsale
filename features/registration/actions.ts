'use server';

import { AuthTokenType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AppError, NotFoundError, ValidationError } from '@/lib/errors';
import { adminAction, publicAction } from '@/lib/server-action';
import { verifyRegistrationChallenge } from '../auth/captcha';
import { deliverAccountAccessLink } from '../auth/notifications';
import { consumeRateLimit } from '../auth/rate-limit';
import { getRequestBaseUrl, getRequestIp } from '../auth/request';
import { issueAuthTokenInTransaction } from '../auth/tokens';
import { assertCustomerAssignment, createCustomerRecord } from '../customers/service';
import { companyRegistrationSchema, convertRegistrationSchema, updateRegistrationStatusSchema } from './schemas';

/** Public sign-up form: rate limited, bot-checked (Turnstile + honeypot), then reviewed by the team. */
export const createCompanyRegistrationAction = publicAction(companyRegistrationSchema, async (input) => {
  const ip = await getRequestIp();
  await consumeRateLimit('registration-ip', ip);
  if (!(await verifyRegistrationChallenge({ token: input.challengeToken, honeypot: input.website, ip }))) {
    throw new ValidationError('לא ניתן לאמת את הבקשה. רעננו את הדף ונסו שוב.');
  }
  await consumeRateLimit('registration-account', input.email);

  const { website: _website, challengeToken: _challengeToken, ...registration } = input;
  const request = await prisma.companyRegistrationRequest.create({ data: { ...registration, status: 'PENDING' } });
  return { requestId: request.id };
});

export const updateRegistrationStatusAction = adminAction(updateRegistrationStatusSchema, async (input, ctx) => {
  await prisma.$transaction(async (tx) => {
    const before = await tx.companyRegistrationRequest.findUnique({ where: { id: input.id }, select: { status: true } });
    if (!before) throw new NotFoundError('בקשת ההרשמה לא נמצאה.');
    if (before.status === 'CONVERTED') throw new AppError('INVALID_STATE', 'הבקשה כבר הומרה ללקוח.');
    await tx.companyRegistrationRequest.update({
      where: { id: input.id },
      data: { status: input.status, ...(input.internalNote !== undefined ? { internalNote: input.internalNote } : {}) },
    });
    await ctx.audit(tx, { entityType: 'CompanyRegistrationRequest', entityId: input.id, action: 'REGISTRATION_STATUS_CHANGED', before, after: { status: input.status } });
  });
  return { requestId: input.id };
});

/** Opens the customer account and hands back (and emails, if configured) a one-time link to choose a password. */
export const convertRegistrationToCustomerAction = adminAction(convertRegistrationSchema, async (input, ctx) => {
  const baseUrl = await getRequestBaseUrl();

  const converted = await prisma.$transaction(async (tx) => {
    const request = await tx.companyRegistrationRequest.findUnique({ where: { id: input.requestId } });
    if (!request) throw new NotFoundError('בקשת ההרשמה לא נמצאה.');
    if (request.status === 'CONVERTED') throw new AppError('INVALID_STATE', 'בקשת ההרשמה כבר הומרה ללקוח.');

    const route = await assertCustomerAssignment(tx, input.routeId, input.priceListId);
    const customerId = await createCustomerRecord(tx, {
      name: request.businessName,
      invoiceName: request.invoiceName,
      contact: request.contactName,
      email: request.email,
      phone: request.phone,
      accountingContactName: request.accountingContactName,
      accountingEmail: request.accountingEmail,
      accountingPhone: request.accountingPhone,
      businessType: request.businessType,
      region: route.region,
      address: request.address,
      deliveryConstraints: request.deliveryNotes,
      notes: request.openingOrderNotes,
      statusLabel: 'נרשם באתר',
      routeId: input.routeId,
      priceListId: input.priceListId,
      isActive: true,
      emailEnabled: true,
      whatsappEnabled: true,
    });
    const user = await tx.user.create({
      data: { email: request.email, name: request.contactName, passwordHash: null, role: 'CUSTOMER', customerId },
    });
    await tx.companyRegistrationRequest.update({
      where: { id: request.id },
      data: { status: 'CONVERTED', convertedCustomerId: customerId },
    });
    const token = await issueAuthTokenInTransaction(tx, { userId: user.id, type: AuthTokenType.PASSWORD_SETUP, baseUrl });
    await ctx.audit(tx, {
      customerId,
      entityType: 'Customer',
      entityId: customerId,
      action: 'REGISTRATION_CONVERTED',
      after: { registrationId: request.id, routeId: input.routeId, priceListId: input.priceListId, userEmail: request.email },
    });
    return { customerId, userId: user.id, setupUrl: token.url };
  });

  const link = await deliverAccountAccessLink({ userId: converted.userId, type: AuthTokenType.PASSWORD_SETUP, url: converted.setupUrl });
  return { customerId: converted.customerId, link };
});
