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
});
