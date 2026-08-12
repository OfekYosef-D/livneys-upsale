export function assertDemoSeedAllowed({
  databaseUrl,
  nodeEnv,
}: {
  databaseUrl: string | undefined;
  nodeEnv: string | undefined;
  allowDestructiveDemoSeed?: string;
}) {
  let hostname = '';
  try {
    hostname = databaseUrl ? new URL(databaseUrl).hostname.toLowerCase() : '';
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL before demo seeding.');
  }

  if (!databaseUrl || nodeEnv === 'production' || hostname.endsWith('.neon.tech')) {
    throw new Error(
      'Refusing to run the destructive demo seed against a production or Neon database.',
    );
  }
}
