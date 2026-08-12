import { prisma } from '../../lib/db';

export async function getAuditLogEntries(search: string) {
  const query = search.trim();
  const entries = await prisma.auditLog.findMany({
    where: query ? {
      OR: [
        { action: { contains: query, mode: 'insensitive' } },
        { entityType: { contains: query, mode: 'insensitive' } },
        { entityId: { contains: query, mode: 'insensitive' } },
        { requestId: { contains: query, mode: 'insensitive' } },
        { actorUser: { is: { name: { contains: query, mode: 'insensitive' } } } },
        { customer: { is: { name: { contains: query, mode: 'insensitive' } } } },
      ],
    } : undefined,
    include: {
      actorUser: { select: { name: true, email: true } },
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return entries.map((entry) => ({
    id: entry.id,
    actorName: entry.actorUser?.name ?? 'מערכת',
    actorRole: entry.actorRole,
    customerName: entry.customer?.name ?? null,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    requestId: entry.requestId,
    before: entry.before,
    after: entry.after,
    metadata: entry.metadata,
    createdAt: entry.createdAt.toISOString(),
  }));
}
