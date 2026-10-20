import { ForgotPasswordClient } from '@/features/auth/components/PasswordAccessClient';
import { isEmailConfigured } from '@/features/notifications/email';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient emailEnabled={isEmailConfigured()} />;
}
