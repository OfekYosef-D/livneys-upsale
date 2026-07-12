import { prisma } from '../../lib/db';

type DatabaseProbe = () => Promise<unknown>;

const defaultDatabaseProbe: DatabaseProbe = () => prisma.$queryRaw`SELECT 1 AS ok`;

export async function checkApplicationHealth(probe: DatabaseProbe = defaultDatabaseProbe): Promise<{ ok: boolean }> {
  try {
    await probe();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
