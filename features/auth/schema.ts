import { fields, z } from '@/lib/validation';
import { isBcryptPasswordLengthSafe, MIN_PASSWORD_LENGTH } from './password-policy';

export const passwordSchema = z.string()
  .min(MIN_PASSWORD_LENGTH, `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים.`)
  .max(128, 'הסיסמה ארוכה מדי.')
  .regex(/\p{L}/u, 'הסיסמה חייבת לכלול לפחות אות אחת.')
  .regex(/[0-9]/, 'הסיסמה חייבת לכלול לפחות ספרה אחת.')
  .refine(isBcryptPasswordLengthSafe, 'הסיסמה ארוכה מדי.');

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128).refine(isBcryptPasswordLengthSafe),
  mfaCode: z.string().trim().max(32).optional().default(''),
});

export const forgotPasswordSchema = z.object({ email: fields.email });

export const passwordTokenSchema = z
  .object({
    token: z.string().trim().min(32).max(256),
    type: z.enum(['setup', 'reset']),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'הסיסמאות אינן זהות.',
  });

export const inviteCustomerUserSchema = z.object({
  customerId: fields.id,
  name: z.string().trim().min(2, 'יש להזין שם מלא.').max(120),
  email: fields.email,
});

export const customerUserSchema = z.object({ customerId: fields.id, userId: fields.id });

export const setCustomerUserActiveSchema = customerUserSchema.extend({ isActive: z.boolean() });

export const startMfaSchema = z.object({
  password: z.string().max(200).refine(isBcryptPasswordLengthSafe).optional().default(''),
});

export const confirmMfaSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'יש להזין קוד בן 6 ספרות.'),
});
