import { describe, expect, it } from 'vitest';
import { assertDemoSeedAllowed } from './database-safety';

describe('assertDemoSeedAllowed', () => {
  it('allows demo seeding against a local development database', () => {
    expect(() => assertDemoSeedAllowed({
      databaseUrl: 'postgresql://postgres:postgres@localhost:5432/livneys_upsale',
      nodeEnv: 'development',
    })).not.toThrow();
  });

  it('refuses destructive seeding against Neon by default', () => {
    expect(() => assertDemoSeedAllowed({
      databaseUrl: 'postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/app',
      nodeEnv: 'development',
    })).toThrow('Refusing to run the destructive demo seed');
  });

  it('cannot be overridden in production or on Neon', () => {
    expect(() => assertDemoSeedAllowed({
      databaseUrl: 'postgresql://postgres:postgres@localhost:5432/livneys_upsale',
      nodeEnv: 'production',
    })).toThrow('Refusing to run the destructive demo seed');

    expect(() => assertDemoSeedAllowed({
      databaseUrl: 'postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/app',
      nodeEnv: 'production',
      allowDestructiveDemoSeed: 'true',
    })).toThrow('Refusing to run the destructive demo seed');

    expect(() => assertDemoSeedAllowed({
      databaseUrl: 'postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/app',
      nodeEnv: 'development',
      allowDestructiveDemoSeed: 'true',
    })).toThrow('Refusing to run the destructive demo seed');
  });
});
