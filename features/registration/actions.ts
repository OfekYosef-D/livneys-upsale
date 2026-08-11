'use server';

import { AuthTokenType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionResult } from '@/lib/action-result';
import { assertAdminAction } from '@/lib/authorization';
import { prisma } from '@/lib/db';
import { verifyRegistrationChallenge } from '../auth/captcha';
import { assertAccountAccessDeliveryConfigured, sendAccountAccessNotifications } from '../auth/notifications';
import { consumeRateLimit } from '../auth/rate-limit';
import { getRequestBaseUrl, getRequestIp } from '../auth/request';
import { issueAuthTokenInTransaction } from '../auth/tokens';
import {
  companyRegistrationSchema,
  convertRegistrationSchema,
  updateRegistrationStatusSchema,
  type CompanyRegistrationInput,
  type ConvertRegistrationInput,
  type UpdateRegistrationStatusInput,
} from './schemas';

export async function createCompanyRegistrationAction(input: CompanyRegistrationInput): Promise<ActionResult<{ requestId: string }>> {
  try {
    const parsed = companyRegistrationSchema.parse(input);
    const ip = await getRequestIp();
    await consumeRateLimit({
      scope: 'registration',
      identifier: `${ip}:${parsed.email}`,
      limit: 3,
      windowMs: 60 * 60 * 1000,
      blockMs: 6 * 60 * 60 * 1000,
    });
    const challengeValid = await verifyRegistrationChallenge({
      token: parsed.challengeToken,
      honeypot: parsed.website,
      ip,
    });
    if (!challengeValid) throw new Error('לא ניתן לאמת את הבקשה. נסו שוב.');
    const { website: _website, challengeToken: _challengeToken, ...registration } = parsed;

    const request = await prisma.companyRegistrationRequest.create({
      data: {
        ...registration,
        status: 'PENDING',
      },
    });

    revalidatePath('/admin/registrations');
    return actionOk({ requestId: request.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateRegistrationStatusAction(input: UpdateRegistrationStatusInput): Promise<ActionResult<{ requestId: string }>> {
  try {
    const parsed = updateRegistrationStatusSchema.parse(input);
    await assertAdminAction();

    const request = await prisma.companyRegistrationRequest.update({
      where: { id: parsed.id },
      data: {
        status: parsed.status,
        ...(parsed.internalNote !== undefined ? { internalNote: parsed.internalNote } : {}),
      },
    });

    revalidatePath('/admin/registrations');
    return actionOk({ requestId: request.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function convertRegistrationToCustomerAction(input: ConvertRegistrationInput): Promise<ActionResult<{ customerId: string }>> {
  try {
    const parsed = convertRegistrationSchema.parse(input);
    await assertAdminAction();
    assertAccountAccessDeliveryConfigured();
    await assertRouteAndPriceList(parsed.routeId, parsed.priceListId);

    const baseUrl = await getRequestBaseUrl();
    const converted = await prisma.$transaction(async (tx) => {
      const request = await tx.companyRegistrationRequest.findUnique({
        where: { id: parsed.requestId },
      });

      if (!request) {
        throw new Error('בקשת ההרשמה לא נמצאה.');
      }

      if (request.status === 'CONVERTED') {
        throw new Error('בקשת ההרשמה כבר הומרה ללקוח.');
      }

      const nextCustomerId = createEntityId('cust', request.businessName);

      await tx.customer.create({
        data: {
          id: nextCustomerId,
          name: request.businessName,
          invoiceName: request.invoiceName,
          contact: request.contactName,
          email: request.email,
          phone: request.phone,
          accountingContactName: request.accountingContactName,
          accountingEmail: request.accountingEmail,
          accountingPhone: request.accountingPhone,
          businessType: request.businessType,
          region: request.businessType,
          address: request.address,
          deliveryConstraints: request.deliveryNotes,
          notes: request.openingOrderNotes,
          statusLabel: 'נרשם באתר',
          routeId: parsed.routeId,
          priceListId: parsed.priceListId,
          isActive: true,
          notificationPreference: {
            create: {
              emailEnabled: true,
              whatsappEnabled: true,
            },
          },
        },
      });

      const user = await tx.user.create({
        data: {
          email: request.email,
          name: request.contactName,
          passwordHash: null,
          role: 'CUSTOMER',
          customerId: nextCustomerId,
        },
      });

      await tx.companyRegistrationRequest.update({
        where: { id: request.id },
        data: {
          status: 'CONVERTED',
          convertedCustomerId: nextCustomerId,
        },
      });

      const setupToken = await issueAuthTokenInTransaction(tx, {
        userId: user.id,
        type: AuthTokenType.PASSWORD_SETUP,
        baseUrl,
      });
      return { customerId: nextCustomerId, userId: user.id, setupUrl: setupToken.url };
    });
    await sendAccountAccessNotifications({
      userId: converted.userId,
      type: AuthTokenType.PASSWORD_SETUP,
      url: converted.setupUrl,
    });

    const customerId = converted.customerId;

    revalidatePath('/admin/registrations');
    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/${customerId}`);
    return actionOk({ customerId });
  } catch (error) {
    return actionError(error);
  }
}

async function assertRouteAndPriceList(routeId: string, priceListId: string) {
  const [route, priceList] = await Promise.all([
    prisma.route.findUnique({ where: { id: routeId } }),
    prisma.priceList.findUnique({ where: { id: priceListId } }),
  ]);

  if (!route || !route.isActive) {
    throw new Error('קו החלוקה לא נמצא או אינו פעיל.');
  }

  if (!priceList) {
    throw new Error('המחירון לא נמצא.');
  }
}

function createEntityId(prefix: string, seed: string): string {
  const slug = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);

  return `${prefix}-${slug || 'item'}-${Date.now().toString(36)}`;
}
