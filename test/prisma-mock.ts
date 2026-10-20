import { vi, type Mock } from 'vitest';

/**
 * A Prisma client test double: every `prisma.<model>.<method>` is a lazily created `vi.fn()`,
 * and `$transaction(fn)` runs `fn` with the same double (so code under test sees one client).
 *
 * Usage in a test file:
 *   vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());
 *   const { prisma } = await import('@/lib/db');
 *   const db = asMock(prisma);
 *   db.order.findUnique.mockResolvedValue(...)
 */
export type PrismaMock = Record<string, Record<string, Mock>> & {
  $transaction: Mock;
  $queryRaw: Mock;
  $executeRaw: Mock;
  /** Clears every mock (calls and implementations) while keeping the structure. */
  $reset: () => void;
};

export function createPrismaMock(): PrismaMock {
  const models = new Map<string, Record<string, Mock>>();
  const root: Record<string, unknown> = {};

  const modelProxy = (name: string) => {
    if (!models.has(name)) {
      const methods: Record<string, Mock> = {};
      models.set(name, new Proxy(methods, {
        get(target, method: string | symbol) {
          if (typeof method === 'symbol') return undefined;
          if (!(method in target)) target[method] = vi.fn();
          return target[method];
        },
      }));
    }
    return models.get(name)!;
  };

  const client = new Proxy(root, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') return undefined;
      if (prop === '$reset') {
        return () => {
          models.forEach((methods) => Object.values(methods).forEach((mock) => mock.mockReset()));
          (['$queryRaw', '$executeRaw'] as const).forEach((key) => (target[key] as Mock | undefined)?.mockReset());
          installTransaction();
        };
      }
      if (prop.startsWith('$')) {
        if (!(prop in target)) target[prop] = vi.fn();
        return target[prop];
      }
      return modelProxy(prop);
    },
  }) as unknown as PrismaMock;

  function installTransaction() {
    const transaction = (root.$transaction ??= vi.fn()) as Mock;
    transaction.mockReset();
    transaction.mockImplementation(async (work: unknown) =>
      typeof work === 'function' ? work(client) : Promise.all(work as Promise<unknown>[]));
  }
  installTransaction();

  return client;
}

/** Factory for `vi.mock('@/lib/db', …)`. */
export function prismaModule() {
  return { prisma: createPrismaMock() };
}

export function asMock(prisma: unknown): PrismaMock {
  return prisma as PrismaMock;
}
