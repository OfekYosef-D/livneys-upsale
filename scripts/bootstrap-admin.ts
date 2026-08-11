import { PrismaClient } from '@prisma/client';
import { bootstrapAdmin } from '../features/deployment/admin-bootstrap';

const prisma = new PrismaClient();

async function main() {
  const result = await bootstrapAdmin(
    {
      email: process.env.BOOTSTRAP_ADMIN_EMAIL,
      name: process.env.BOOTSTRAP_ADMIN_NAME,
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    },
    {
      $transaction: (callback) => prisma.$transaction((tx) => callback({ user: tx.user, authToken: tx.authToken })),
    },
  );

  console.log(`Administrator is ready: ${result.email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Administrator bootstrap failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
