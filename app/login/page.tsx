import { CustomerLoginClient } from '@/features/auth/components/CustomerLoginClient';
import { getCustomerLoginOptions } from '@/features/auth/queries';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const customers = await getCustomerLoginOptions();

  return <CustomerLoginClient customers={customers} />;
}
