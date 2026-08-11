import type { NextAuthOptions, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { authenticateCredentials } from '@/features/auth/authenticate';

type AuthorizedUser = User & {
  role: 'ADMIN' | 'CUSTOMER';
  customerId: string | null;
  sessionVersion: number;
  mfaEnabled: boolean;
};

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        mfaCode: { label: 'MFA code', type: 'text' },
      },
      async authorize(rawCredentials, request) {
        const forwarded = request.headers?.['x-forwarded-for'];
        const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim();
        const user = await authenticateCredentials(rawCredentials, { ip: ip || 'unknown' });
        return user satisfies AuthorizedUser | null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const authorizedUser = user as AuthorizedUser;
        token.id = authorizedUser.id;
        token.role = authorizedUser.role;
        token.customerId = authorizedUser.customerId;
        token.sessionVersion = authorizedUser.sessionVersion;
        token.mfaEnabled = authorizedUser.mfaEnabled;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'ADMIN' | 'CUSTOMER';
        session.user.customerId = (token.customerId as string | null | undefined) ?? null;
        session.user.sessionVersion = token.sessionVersion as number;
        session.user.mfaEnabled = Boolean(token.mfaEnabled);
      }

      return session;
    },
  },
};
