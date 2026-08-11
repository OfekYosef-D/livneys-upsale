import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'ADMIN' | 'CUSTOMER';
      customerId: string | null;
      sessionVersion?: number;
      mfaEnabled?: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: 'ADMIN' | 'CUSTOMER';
    customerId?: string | null;
    sessionVersion?: number;
    mfaEnabled?: boolean;
  }
}
