import { describe, expect, it } from 'vitest';
import {
  buildCrmOrders,
  getCrmKpis,
  getCustomerSignals,
  getRouteReadiness,
  getSalesOpportunities,
  type CrmDemoState,
} from './crm-utils';

const products = [
  { id: 'spread', name: 'ממרח חציל', category: 'ממרחים', price: 28, unit: 'צנצנת', minQty: 6 },
  { id: 'sauce', name: 'רוטב עשבים', category: 'רטבים', price: 31, unit: 'בקבוק', minQty: 5 },
  { id: 'kit', name: 'מארז טעימות', category: 'מארזים', price: 118, unit: 'מארז', minQty: 2 },
];

const customers = [
  { id: 'cust-opened', name: 'לקוח פתוח', contact: 'נועה', phone: '1', region: 'דרום', routeId: 'route-south', status: 'פתח לינק', address: 'א', notes: 'פתח קישור ולא הזמין' },
  { id: 'cust-ordered', name: 'לקוח מזמין', contact: 'דן', phone: '2', region: 'מרכז', routeId: 'route-center', status: 'הזמין', address: 'ב', notes: 'רגיש למחיר' },
  { id: 'cust-follow', name: 'לקוח מעקב', contact: 'רון', phone: '3', region: 'דרום', routeId: 'route-south', status: 'צריך מעקב', address: 'ג', notes: 'מבקש וואטסאפ' },
];

const routes = [
  { id: 'route-south', name: 'דרום', nextDelivery: '2026-06-25', deadline: '2026-06-23 18:00', driver: 'אורי', customerIds: ['cust-opened', 'cust-follow'] },
  { id: 'route-center', name: 'מרכז', nextDelivery: '2026-06-24', deadline: '2026-06-22 18:00', driver: 'דנה', customerIds: ['cust-ordered'] },
];

const orders = [
  { id: 'ord-new', customerId: 'cust-opened', date: '2026-06-21', status: 'טיוטה', items: [{ productId: 'spread', qty: 6 }] },
  { id: 'ord-review', customerId: 'cust-ordered', date: '2026-06-20', status: 'התקבל', items: [{ productId: 'sauce', qty: 10 }] },
  { id: 'ord-done', customerId: 'cust-follow', date: '2026-06-10', status: 'סופק', items: [{ productId: 'spread', qty: 6 }] },
];

const promotions = [
  { id: 'promo-sauce', title: 'מבצע רוטב', tag: 'שבועי', description: 'הוספת רוטב להזמנה', productId: 'sauce' },
  { id: 'promo-kit', title: 'מארז טעימות', tag: 'חדש', description: 'פתיחת קטגוריה', productId: 'kit' },
];

describe('crm utilities', () => {
  it('derives an order queue and applies local demo status overrides', () => {
    const state: CrmDemoState = { orderStatuses: { 'ord-new': 'approved' } };
    const crmOrders = buildCrmOrders({ orders, customers, routes, products, state });

    expect(crmOrders.map((order) => [order.id, order.status, order.total])).toEqual([
      ['ord-new', 'approved', 168],
      ['ord-review', 'needs_review', 310],
      ['ord-done', 'completed', 168],
    ]);
    expect(crmOrders[0].nextAction).toBe('לאריזה');
  });

  it('calculates dashboard KPIs from CRM orders, signals, opportunities, and route readiness', () => {
    const crmOrders = buildCrmOrders({ orders, customers, routes, products, state: { orderStatuses: { 'ord-new': 'approved' } } });
    const signals = getCustomerSignals({ customers, orders, state: { contactedCustomers: { 'cust-follow': true } } });
    const opportunities = getSalesOpportunities({ customers, orders, products, promotions, state: { dismissedOpportunityIds: ['cust-opened-sauce'] } });
    const readiness = getRouteReadiness({ routes, customers, crmOrders });

    expect(getCrmKpis({ crmOrders, signals, opportunities, readiness })).toEqual({
      openOrders: 2,
      needsApproval: 1,
      readyForRoute: 1,
      followUps: 1,
      opportunities: 2,
    });
  });

  it('derives customer follow-up signals and marks contacted customers', () => {
    const signals = getCustomerSignals({ customers, orders, state: { contactedCustomers: { 'cust-follow': true } } });

    expect(signals.map((signal) => [signal.customerId, signal.kind, signal.isDone])).toEqual([
      ['cust-opened', 'opened_no_order', false],
      ['cust-follow', 'needs_contact', true],
    ]);
  });

  it('calculates route readiness buckets from latest CRM order state', () => {
    const crmOrders = buildCrmOrders({ orders, customers, routes, products, state: { orderStatuses: { 'ord-new': 'packed' } } });

    expect(getRouteReadiness({ routes, customers, crmOrders })).toEqual([
      { routeId: 'route-south', routeName: 'דרום', totalCustomers: 2, readyCount: 1, actionRequiredCount: 0, missingOrderCount: 1, readinessPercent: 50 },
      { routeId: 'route-center', routeName: 'מרכז', totalCustomers: 1, readyCount: 0, actionRequiredCount: 1, missingOrderCount: 0, readinessPercent: 0 },
    ]);
  });

  it('generates sales opportunities and removes dismissed items', () => {
    const opportunities = getSalesOpportunities({
      customers,
      orders,
      products,
      promotions,
      state: { dismissedOpportunityIds: ['cust-opened-sauce'] },
    });

    expect(opportunities.map((opportunity) => [opportunity.id, opportunity.customerId, opportunity.productId, opportunity.potentialValue])).toEqual([
      ['cust-follow-sauce', 'cust-follow', 'sauce', 155],
      ['cust-opened-kit', 'cust-opened', 'kit', 236],
    ]);
  });
});
