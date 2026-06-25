import bcrypt from 'bcryptjs';
import type { NextAuthOptions, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { credentialsSchema } from '@/features/auth/schema';
import { prisma } from '@/lib/db';

type AuthorizedUser = User & {
  role: 'ADMIN' | 'CUSTOMER';
  customerId: string | null;
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
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { customer: true },
        });

        if (!user) {
          return null;
        }

        if (user.role === 'CUSTOMER' && (!user.customer || !user.customer.isActive)) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);

        if (!isValidPassword) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          customerId: user.customerId,
        } satisfies AuthorizedUser;
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
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'ADMIN' | 'CUSTOMER';
        session.user.customerId = (token.customerId as string | null | undefined) ?? null;
      }

      return session;
    },
  },
};
