import { prisma } from '@/lib/db';

export type CustomerLoginOption = {
  id: string;
  name: string;
  region: string;
  email: string;
};

export async function getCustomerLoginOptions(): Promise<CustomerLoginOption[]> {
  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
      user: {
        is: {
          role: 'CUSTOMER',
        },
      },
    },
    select: {
      id: true,
      name: true,
      region: true,
      user: {
        select: {
          email: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return customers
    .filter((customer) => customer.user?.email)
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      region: customer.region,
      email: customer.user?.email ?? '',
    }));
}
