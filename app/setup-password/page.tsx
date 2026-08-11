import { PasswordTokenClient } from '@/features/auth/components/PasswordAccessClient';

export default async function SetupPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  return <PasswordTokenClient token={token} type="setup" />;
}
