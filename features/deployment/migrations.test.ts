import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Prisma migration files', () => {
  it('do not begin with a UTF-8 byte order mark', () => {
    const migrationsDirectory = path.join(process.cwd(), 'prisma', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(migrationsDirectory, entry.name, 'migration.sql'))
      .filter((file) => fs.existsSync(file));

    for (const file of migrationFiles) {
      const bytes = fs.readFileSync(file);
      expect([...bytes.subarray(0, 3)], path.relative(process.cwd(), file)).not.toEqual([0xef, 0xbb, 0xbf]);
    }
  });

  it('guards non-cancelled delivery windows before adding the order integrity constraint', () => {
    const migrationFile = path.join(
      process.cwd(),
      'prisma',
      'migrations',
      '20260811123000_order_integrity',
      'migration.sql',
    );
    const sql = fs.readFileSync(migrationFile, 'utf8');

    expect(sql).toContain('RAISE EXCEPTION');
    expect(sql).toContain('GROUP BY "customerId", "deliveryWindowStart"');
    expect(sql).toContain('WHERE "status" <> \'CANCELLED\'');
    expect(sql).toContain('CREATE UNIQUE INDEX "Order_one_non_cancelled_per_delivery_window_key"');
    expect(sql).toContain('ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1');
    expect(sql).toContain('ADD COLUMN "idempotencyKey" TEXT');
    expect(sql).toContain('ON DELETE RESTRICT ON UPDATE CASCADE');
    expect(sql).not.toMatch(/^\s*(?:DELETE\s+FROM|TRUNCATE\s+)/im);
  });
});
