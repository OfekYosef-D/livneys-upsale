'use client';

import type { CrmDemoState, CrmOrderStatus } from '@/lib/crm-utils';

export const crmStateKey = 'livneys-crm-demo-state';

export function readCrmState(): CrmDemoState {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const value = window.localStorage.getItem(crmStateKey);
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

export function writeCrmState(state: CrmDemoState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(crmStateKey, JSON.stringify(state));
}

export function setOrderStatus(state: CrmDemoState, orderId: string, status: CrmOrderStatus): CrmDemoState {
  return {
    ...state,
    orderStatuses: {
      ...state.orderStatuses,
      [orderId]: status,
    },
  };
}

export function markCustomerContacted(state: CrmDemoState, customerId: string): CrmDemoState {
  return {
    ...state,
    contactedCustomers: {
      ...state.contactedCustomers,
      [customerId]: true,
    },
  };
}

export function dismissOpportunity(state: CrmDemoState, opportunityId: string): CrmDemoState {
  return {
    ...state,
    dismissedOpportunityIds: [...new Set([...(state.dismissedOpportunityIds ?? []), opportunityId])],
  };
}

export function setInternalNote(state: CrmDemoState, customerId: string, note: string): CrmDemoState {
  return {
    ...state,
    internalNotes: {
      ...state.internalNotes,
      [customerId]: note,
    },
  };
}
