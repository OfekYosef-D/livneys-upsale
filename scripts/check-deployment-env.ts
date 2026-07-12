import { ZodError } from 'zod';
import { parseDeploymentEnv } from '../features/deployment/config';

try {
  const config = parseDeploymentEnv(process.env);
  console.log(`Deployment environment is valid. WhatsApp mode: ${config.whatsappSendEnabled ? 'live' : 'dry-run'}.`);
} catch (error) {
  if (error instanceof ZodError) {
    const fields = [...new Set(error.issues.map((issue) => issue.path.join('.') || 'environment'))];
    console.error(`Deployment environment is invalid. Check: ${fields.join(', ')}.`);
  } else {
    console.error('Deployment environment validation failed.');
  }
  process.exit(1);
}
