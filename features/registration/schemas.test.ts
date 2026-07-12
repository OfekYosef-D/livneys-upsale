import { describe, expect, it } from 'vitest';
import {
  companyRegistrationSchema,
  convertRegistrationSchema,
  updateRegistrationStatusSchema,
} from './schemas';

describe('company registration schemas', () => {
  it('normalizes public company registration details', () => {
    const parsed = companyRegistrationSchema.parse({
      businessName: '  Cafe South  ',
      invoiceName: 'Cafe South Ltd',
      contactName: 'Dana',
      phone: '050-1111111',
      email: 'DANA@EXAMPLE.COM',
      accountingContactName: 'Roni',
      accountingEmail: 'ACCOUNTING@EXAMPLE.COM',
      accountingPhone: '050-2222222',
      businessType: 'בתי קפה',
      address: 'Industrial 4',
      deliveryNotes: '',
      openingOrderNotes: 'Interested in tastings',
    });

    expect(parsed).toMatchObject({
      businessName: 'Cafe South',
      email: 'dana@example.com',
      accountingEmail: 'accounting@example.com',
      deliveryNotes: null,
    });
  });

  it('validates admin conversion inputs', () => {
    expect(
      convertRegistrationSchema.parse({
        requestId: 'lead-1',
        routeId: 'route-south',
        priceListId: 'price-list-standard',
        temporaryPassword: 'livneys-demo',
      }),
    ).toMatchObject({
      requestId: 'lead-1',
      temporaryPassword: 'livneys-demo',
    });
  });

  it('accepts admin lifecycle statuses for lead triage', () => {
    expect(updateRegistrationStatusSchema.parse({ id: 'lead-1', status: 'CONTACTED' })).toEqual({
      id: 'lead-1',
      status: 'CONTACTED',
    });
  });
});
