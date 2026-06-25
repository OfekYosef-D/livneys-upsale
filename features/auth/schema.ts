import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
