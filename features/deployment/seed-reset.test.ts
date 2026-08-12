import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('local demo reset', () => {
  it('uses a local-only cascading truncate so immutable legal and audit rows cannot block reset', () => {
    const seed = fs.readFileSync(path.join(process.cwd(), 'prisma', 'seed.ts'), 'utf8');

    expect(seed).toContain('TRUNCATE TABLE');
    expect(seed).toContain('RESTART IDENTITY CASCADE');
    expect(seed).not.toContain('prisma.order.deleteMany()');
  });
});
