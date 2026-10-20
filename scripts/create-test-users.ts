import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { BCRYPT_ROUNDS } from '../features/auth/security';

/**
 * Creates (or resets) one test administrator and one test customer login on the database in
 * DATABASE_URL – meant for a preview/staging database, never production. Emails use the reserved
 * `.test` domain so nothing is ever delivered. Run again to issue fresh passwords.
 */
const ADMIN_EMAIL = 'pilot-admin@livneys.test';
const CUSTOMER_EMAIL = 'pilot-customer@livneys.test';
const CUSTOMER_ID = 'cust-pilot-test';
const OUTPUT_FILE = '.test-users.local.txt';

const prisma = new PrismaClient();

/** Satisfies the password policy (10+ characters, a letter and a digit). */
function generatePassword() {
  return `Test-${randomBytes(9).toString('base64url')}-${randomBytes(1)[0] % 10}`;
}

async function upsertLogin(email: string, name: string, password: string, customerId: string | null) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const role = customerId ? 'CUSTOMER' : 'ADMIN';
  const now = new Date();
  await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash, passwordChangedAt: now, role, customerId },
    update: { name, passwordHash, passwordChangedAt: now, role, customerId, isActive: true, sessionVersion: { increment: 1 } },
  });
}

/** A test business on the first active route and price list (both must already exist). */
async function ensureTestCustomer() {
  const [route, priceList] = await Promise.all([
    prisma.route.findFirst({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.priceList.findFirst({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
  ]);
  if (!route || !priceList) return null;

  await prisma.customer.upsert({
    where: { id: CUSTOMER_ID },
    create: {
      id: CUSTOMER_ID,
      name: 'לקוח בדיקה (פיילוט)',
      contact: 'בודק',
      email: CUSTOMER_EMAIL,
      phone: '050-000-0000',
      region: route.region,
      address: 'כתובת בדיקה',
      notes: 'חשבון בדיקה – לא לקוח אמיתי.',
      routeId: route.id,
      priceListId: priceList.id,
      notificationPreference: { create: { emailEnabled: true, whatsappEnabled: false } },
    },
    update: { isActive: true },
  });
  return { route: route.name, priceList: priceList.name };
}

async function main() {
  if (process.env.VERCEL_ENV === 'production') throw new Error('Refusing to create test users on production.');
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to the preview database first.');

  const adminPassword = generatePassword();
  await upsertLogin(ADMIN_EMAIL, 'מנהל בדיקה', adminPassword, null);
  const lines = [`Admin     ${ADMIN_EMAIL}  ${adminPassword}`];

  const customer = await ensureTestCustomer();
  if (customer) {
    const customerPassword = generatePassword();
    await upsertLogin(CUSTOMER_EMAIL, 'בודק', customerPassword, CUSTOMER_ID);
    lines.push(`Customer  ${CUSTOMER_EMAIL}  ${customerPassword}  (route: ${customer.route}, price list: ${customer.priceList})`);
  } else {
    lines.push('Customer  not created: add an active route and a price list in the CRM, then run this again.');
  }

  writeFileSync(OUTPUT_FILE, `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
  console.log(`\nSaved to ${OUTPUT_FILE} (git-ignored). Log in at <preview-url>/login.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Creating test users failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
