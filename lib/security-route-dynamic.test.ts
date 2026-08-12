import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('nonce CSP rendering contract', () => {
  it('forces the root application tree to render per request', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app', 'layout.tsx'), 'utf8');

    expect(source).toContain("export const dynamic = 'force-dynamic'");
  });
});
