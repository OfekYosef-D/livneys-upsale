import { describe, expect, it } from 'vitest';
import config from './tailwind.config';

describe('tailwind config', () => {
  it('scans feature modules for CRM utility classes', () => {
    expect(config.content).toEqual(expect.arrayContaining(['./features/**/*.{ts,tsx}']));
  });
});
