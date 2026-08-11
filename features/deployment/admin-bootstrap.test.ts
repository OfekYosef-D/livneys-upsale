import { describe, expect, it, vi } from 'vitest';
import { bootstrapAdmin, parseBootstrapAdminInput } from './admin-bootstrap';

describe('production admin bootstrap', () => {
  it('normalizes a strong administrator credential set', () => {
    const result = parseBootstrapAdminInput({
      email: ' Owner@Livneys.co.il ',
      name: 'Livneys Owner',
      password: 'Strong-Admin-Password-2026!',
    });

    expect(result.email).toBe('owner@livneys.co.il');
  });

  it('rejects placeholder emails and weak passwords', () => {
    expect(() => parseBootstrapAdminInput({
      email: 'admin@livneys.local',
      name: 'Admin',
      password: 'livneys-admin',
    })).toThrow();
  });

  it('upserts only the requested administrator record', async () => {
    const findUnique = vi.fn(async () => null);
    const upsert = vi.fn(async () => ({ id: 'admin-1', email: 'owner@livneys.co.il' }));
    const updateMany = vi.fn();
    const database = {
      $transaction: vi.fn(async (callback: (tx: never) => Promise<{ id: string; email: string }>) => callback({ user: { findUnique, upsert }, authToken: { updateMany } } as never)),
    };

    const now = new Date('2026-08-11T19:00:00.000Z');
    const result = await bootstrapAdmin(
      {
        email: 'owner@livneys.co.il',
        name: 'Livneys Owner',
        password: 'Strong-Admin-Password-2026!',
      },
      database,
      { now },
    );

    expect(result).toEqual({ id: 'admin-1', email: 'owner@livneys.co.il' });
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'owner@livneys.co.il' },
      create: expect.objectContaining({ role: 'ADMIN', customerId: null }),
      update: expect.objectContaining({
        role: 'ADMIN', customerId: null, passwordChangedAt: now, sessionVersion: { increment: 1 },
      }),
    }));
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'admin-1', usedAt: null },
      data: { usedAt: now },
    });
  });

  it('refuses to convert an existing customer account into an administrator', async () => {
    const findUnique = vi.fn(async () => ({ role: 'CUSTOMER', customerId: 'customer-1' }));
    const upsert = vi.fn();
    const updateMany = vi.fn();
    const database = {
      $transaction: vi.fn(async (callback: (tx: never) => Promise<{ id: string; email: string }>) => callback({ user: { findUnique, upsert }, authToken: { updateMany } } as never)),
    };

    await expect(bootstrapAdmin(
      {
        email: 'owner@livneys.co.il',
        name: 'Livneys Owner',
        password: 'Strong-Admin-Password-2026!',
      },
      database,
    )).rejects.toThrow('customer account');
    expect(upsert).not.toHaveBeenCalled();
  });
});
