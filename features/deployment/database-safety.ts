export function assertDemoSeedAllowed({
  databaseUrl,
  nodeEnv,
  allowDestructiveDemoSeed,
}: {
  databaseUrl: string | undefined;
  nodeEnv: string | undefined;
  allowDestructiveDemoSeed?: string;
}) {
  if (allowDestructiveDemoSeed === 'true') return;

  let hostname = '';
  try {
    hostname = databaseUrl ? new URL(databaseUrl).hostname.toLowerCase() : '';
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL before demo seeding.');
  }

  if (!databaseUrl || nodeEnv === 'production' || hostname.endsWith('.neon.tech')) {
    throw new Error(
      'Refusing to run the destructive demo seed against a production or Neon database. Set ALLOW_DESTRUCTIVE_DEMO_SEED=true only if data loss is intentional.',
    );
  }
}
