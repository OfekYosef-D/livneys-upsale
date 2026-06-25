import type { UserRole } from '@prisma/client';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  customerId: string | null;
};
