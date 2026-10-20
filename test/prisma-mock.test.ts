import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());

const { prisma } = await import('@/lib/db');
const { asMock } = await import('./prisma-mock');

describe('prisma test double', () => {
  it('auto-creates model methods and runs interactive transactions with the same client', async () => {
    const db = asMock(prisma);
    db.order.findUnique.mockResolvedValue({ id: 'o1' });
    const result = await prisma.$transaction((tx) => tx.order.findUnique({ where: { id: 'o1' } }));
    expect(result).toEqual({ id: 'o1' });

    db.$reset();
    expect(await prisma.$transaction((tx) => tx.order.findUnique({ where: { id: 'o1' } }))).toBeUndefined();
  });
});
