import bcrypt from 'bcryptjs';
import { z } from 'zod';

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
    .regex(/[^A-Za-z0-9]/, 'Password must include a symbol.'),
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

export function parseBootstrapAdminInput(input: BootstrapAdminInput): ParsedBootstrapAdminInput {
  return bootstrapAdminSchema.parse(input);
}

export async function bootstrapAdmin(
  input: BootstrapAdminInput,
  users: AdminUserClient,
  { now = new Date() }: { now?: Date } = {},
) {
  const parsed = parseBootstrapAdminInput(input);
  const existing = await users.findUnique({
    where: { email: parsed.email },
    select: { role: true, customerId: true },
  });

  if (existing && (existing.role !== 'ADMIN' || existing.customerId)) {
    throw new Error('Refusing to convert an existing customer account into an administrator.');
  }

  const passwordHash = await bcrypt.hash(parsed.password, 12);
  return users.upsert({
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
}
