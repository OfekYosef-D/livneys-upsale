import { z } from 'zod';
import { passwordSchema } from './security';

export const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  mfaCode: z.string().trim().max(32).optional().default(''),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

export const passwordTokenSchema = z.object({
  token: z.string().trim().min(32).max(256),
  password: passwordSchema,
  passwordConfirmation: z.string(),
}).refine((value) => value.password === value.passwordConfirmation, {
  path: ['passwordConfirmation'],
  message: 'הסיסמאות אינן זהות.',
});

export const inviteCustomerUserSchema = z.object({
  customerId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
});

export const setCustomerUserActiveSchema = z.object({
  customerId: z.string().trim().min(1).max(120),
  userId: z.string().trim().min(1).max(120),
  isActive: z.boolean(),
});

export const startMfaSchema = z.object({
  intent: z.literal('start'),
});

export const confirmMfaSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
