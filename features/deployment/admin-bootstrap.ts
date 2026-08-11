import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { isBcryptPasswordLengthSafe } from '../auth/security';

const bootstrapAdminSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()).refine(
    (value) => !value.endsWith('.local') && !value.endsWith('@example.com'),
    'Use a real administrator email, not a placeholder address.',
  ),
  name: z.string().trim().min(2).max(120),
  password: z.string()
    .min(16)
    .max(200)
    .regex(/[a-z]/, 'Password must include a lowercase letter.')
    .regex(/[A-Z]/, 'Password must include an uppercase letter.')
    .regex(/[0-9]/, 'Password must include a number.')
    .regex(/[^A-Za-z0-9]/, 'Password must include a symbol.')
    .refine(isBcryptPasswordLengthSafe, 'Password must not exceed 72 UTF-8 bytes.'),
});

export type BootstrapAdminInput = {
  email?: unknown;
  name?: unknown;
  password?: unknown;
};
type ParsedBootstrapAdminInput = z.output<typeof bootstrapAdminSchema>;

type AdminUserClient = {
  findUnique(args: { where: { email: string }; select: { role: true; customerId: true } }): Promise<{ role: string; customerId: string | null } | null>;
  upsert(args: {
    where: { email: string };
    create: { email: string; name: string; passwordHash: string; passwordChangedAt: Date; role: 'ADMIN'; customerId: null };
    update: {
      name: string;
      passwordHash: string;
      passwordChangedAt: Date;
      sessionVersion: { increment: 1 };
      role: 'ADMIN';
      customerId: null;
    };
    select: { id: true; email: true };
  }): Promise<{ id: string; email: string }>;
};

type AdminBootstrapTransaction = {
  user: AdminUserClient;
  authToken: {
    updateMany(args: {
      where: { userId: string; usedAt: null };
      data: { usedAt: Date };
    }): Promise<unknown>;
  };
};

type AdminBootstrapDatabase = {
  $transaction(
    callback: (tx: AdminBootstrapTransaction) => Promise<{ id: string; email: string }>,
  ): Promise<{ id: string; email: string }>;
};

export function parseBootstrapAdminInput(input: BootstrapAdminInput): ParsedBootstrapAdminInput {
  return bootstrapAdminSchema.parse(input);
}

export async function bootstrapAdmin(
  input: BootstrapAdminInput,
  database: AdminBootstrapDatabase,
  { now = new Date() }: { now?: Date } = {},
) {
  const parsed = parseBootstrapAdminInput(input);
  const passwordHash = await bcrypt.hash(parsed.password, 12);
  return database.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email: parsed.email },
      select: { role: true, customerId: true },
    });

    if (existing && (existing.role !== 'ADMIN' || existing.customerId)) {
      throw new Error('Refusing to convert an existing customer account into an administrator.');
    }

    const administrator = await tx.user.upsert({
      where: { email: parsed.email },
      create: {
        email: parsed.email,
        name: parsed.name,
        passwordHash,
        passwordChangedAt: now,
        role: 'ADMIN',
        customerId: null,
      },
      update: {
        name: parsed.name,
        passwordHash,
        passwordChangedAt: now,
        sessionVersion: { increment: 1 },
        role: 'ADMIN',
        customerId: null,
      },
      select: { id: true, email: true },
    });
    await tx.authToken.updateMany({
      where: { userId: administrator.id, usedAt: null },
      data: { usedAt: now },
    });
    return administrator;
  });
}
