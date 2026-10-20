/** Single source of truth for in-app URLs. */
export const paths = {
  login: (next?: string) => (next ? `/login?next=${encodeURIComponent(next)}` : '/login'),
  register: '/register',
  forgotPassword: '/forgot-password',
  legal: (slug: string) => `/legal/${slug}`,

  admin: {
    home: '/admin',
    manualOrder: (customerId?: string) => (customerId ? `/admin/manual-order?customerId=${encodeURIComponent(customerId)}` : '/admin/manual-order'),
    customers: '/admin/customers',
    customer: (customerId: string) => `/admin/customers/${customerId}`,
    order: (orderId: string) => `/admin/orders/${orderId}`,
    orderAddition: (orderId: string) => `/admin/orders/${orderId}/addition`,
    routes: '/admin/routes',
    route: (routeId: string) => `/admin/routes/${routeId}`,
    registrations: '/admin/registrations',
    notifications: (query?: string) => (query ? `/admin/notifications?q=${encodeURIComponent(query)}` : '/admin/notifications'),
    products: '/admin/products',
    priceLists: '/admin/price-lists',
    promotions: '/admin/promotions',
    recommendations: '/admin/recommendations',
    audit: '/admin/audit',
    security: '/admin/security/mfa',
  },

  customer: {
    home: (customerId: string) => `/customer/${customerId}`,
    review: (customerId: string) => `/customer/${customerId}/review`,
    confirmation: (customerId: string, orderId: string) => `/customer/${customerId}/confirmation?orderId=${encodeURIComponent(orderId)}`,
    order: (customerId: string, orderNumber: number) => `/customer/${customerId}/orders/${orderNumber}`,
    orderAddition: (customerId: string, orderNumber: number) => `/customer/${customerId}/orders/${orderNumber}/addition`,
  },
} as const;
