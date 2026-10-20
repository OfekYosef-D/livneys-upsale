import { randomBytes } from 'node:crypto';

/**
 * Readable, URL-safe ids for business entities (e.g. `cust-lq2x9k3a`). Names are usually Hebrew,
 * so the id does not try to include a slug.
 */
export function createEntityId(prefix: 'cust' | 'prod' | 'route' | 'promo' | 'price-list'): string {
  return `${prefix}-${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
}
