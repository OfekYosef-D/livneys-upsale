import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const auditRoot = path.join(root, 'docs', 'ux-audit', '2026-07-10');
const screenshotRoot = path.join(auditRoot, 'screenshots');
const baseUrl = process.env.UX_AUDIT_BASE_URL ?? 'http://localhost:3000';
const chromePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chromePort = Number(process.env.UX_AUDIT_CHROME_PORT ?? 9322);
const chromeProfilesRoot = path.join(root, '.ux-audit-chrome-profiles');
const chromeProfile = path.join(chromeProfilesRoot, `run-${process.pid}-${Date.now()}`);
const prisma = new PrismaClient();

const viewports = [
  { name: 'desktop', width: 1440, height: 1000, scale: 1, mobile: false },
  { name: 'mobile', width: 390, height: 844, scale: 2, mobile: true },
];

const publicRoutes = [
  { slug: 'home', path: '/' },
  { slug: 'customer-login', path: '/login' },
  { slug: 'register', path: '/register' },
  { slug: 'admin-login', path: '/admin/login' },
];

const adminRoutes = [
  { slug: 'admin-dashboard', path: '/admin' },
  { slug: 'manual-order', path: '/admin/manual-order', after: selectFirstManualOrderCustomer },
  { slug: 'customers', path: '/admin/customers', create: 'הוסף לקוח', edit: 'עריכה' },
  { slug: 'registrations', path: '/admin/registrations' },
  { slug: 'routes', path: '/admin/routes', create: 'הוסף קו', edit: 'עריכה' },
  { slug: 'notifications', path: '/admin/notifications', after: openNotificationSettings },
  { slug: 'products', path: '/admin/products', create: 'הוסף מוצר', edit: 'עריכה' },
  { slug: 'price-lists', path: '/admin/price-lists', create: 'הוסף מחירון', clone: 'שכפול', edit: 'עריכה' },
  { slug: 'promotions', path: '/admin/promotions', create: 'הוסף מבצע', edit: 'עריכה' },
  { slug: 'recommendations', path: '/admin/recommendations', create: 'הוסף המלצה', edit: 'עריכה' },
];

const manifest = [];

class CdpPage {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();

    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result ?? {});
        return;
      }

      const handlers = this.events.get(message.method) ?? [];
      for (const handler of handlers) handler(message.params ?? {});
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 15000);
    });
  }

  on(method, handler) {
    const handlers = this.events.get(method) ?? [];
    handlers.push(handler);
    this.events.set(method, handlers);
  }
}

async function main() {
  await rm(screenshotRoot, { recursive: true, force: true });
  await mkdir(screenshotRoot, { recursive: true });

  const fixtures = await ensureAuditFixtures();
  const chrome = startChrome();
  let page;

  try {
    page = await connectToChrome();
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('DOM.enable');

    for (const viewport of viewports) {
      await mkdir(path.join(screenshotRoot, viewport.name), { recursive: true });
      await setViewport(page, viewport);

      for (const route of publicRoutes) {
        await captureRoute(page, viewport, route.slug, route.path);
      }

      await loginAdmin(page);

      for (const route of adminRoutes) {
        await captureRoute(page, viewport, route.slug, route.path);

        if (route.after) {
          await route.after(page);
          await capture(page, viewport, `${route.slug}-state`, route.path, 'state');
        }

        if (route.slug === 'registrations') {
          await capture(page, viewport, 'registrations-conversion-card', route.path, 'conversion-card');
        }

        if (route.create) {
          await clickText(page, route.create);
          await capture(page, viewport, `${route.slug}-create-modal`, route.path, 'create-modal');
          await closeDialog(page);
        }

        if (route.clone) {
          await clickText(page, route.clone);
          await capture(page, viewport, `${route.slug}-clone-modal`, route.path, 'clone-modal');
          await closeDialog(page);
        }

        if (route.edit) {
          await clickText(page, route.edit);
          await capture(page, viewport, `${route.slug}-edit-modal`, route.path, 'edit-modal');
          await closeDialog(page);
        }
      }

      await captureRoute(page, viewport, 'customer-detail', `/admin/customers/${fixtures.customerId}`);
      await captureRoute(page, viewport, 'route-detail', `/admin/routes/${fixtures.routeId}`);
      await captureRoute(page, viewport, 'order-detail', `/admin/orders/${fixtures.orderId}`);

      await loginCustomer(page);
      await captureRoute(page, viewport, 'customer-catalog', `/customer/${fixtures.customerId}`);
      await captureRoute(page, viewport, 'customer-review', `/customer/${fixtures.customerId}/review`);
      await captureRoute(page, viewport, 'customer-confirmation', `/customer/${fixtures.customerId}/confirmation?orderId=${fixtures.orderId}`);
    }
  } finally {
    await cleanupAuditFixtures();
    await page?.send('Browser.close').catch(() => {});
    chrome.kill();
    await waitForProcessClose(chrome);
    await prisma.$disconnect();
    await safeRm(chromeProfile);
  }

  await writeFile(path.join(auditRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Wrote ${manifest.length} screenshots to ${screenshotRoot}`);
}

async function ensureAuditFixtures() {
  const [customer, route, order] = await Promise.all([
    prisma.customer.findFirst({ orderBy: { id: 'asc' } }),
    prisma.route.findFirst({ orderBy: { id: 'asc' } }),
    prisma.order.findFirst({ where: { status: { not: 'DRAFT' } }, orderBy: { createdAt: 'desc' } }),
  ]);

  if (!customer || !route || !order) {
    throw new Error('Seeded customer, route, and submitted order are required for UX audit capture.');
  }

  await prisma.companyRegistrationRequest.upsert({
    where: { id: 'ux-audit-registration-lead' },
    create: {
      id: 'ux-audit-registration-lead',
      businessName: 'קפה בדיקה UX',
      invoiceName: 'קפה בדיקה בע"מ',
      contactName: 'דנה בדיקה',
      phone: '050-1234567',
      email: 'ux-audit-registration@example.com',
      accountingContactName: 'רוני חשבונות',
      accountingEmail: 'ux-audit-accounts@example.com',
      accountingPhone: '050-7654321',
      businessType: 'בתי קפה',
      address: 'רחוב בדיקה 1, תל אביב',
      deliveryNotes: 'לקבל סחורה אחרי 10:00',
      openingOrderNotes: 'רוצה טעימות לפני הזמנה קבועה',
      status: 'PENDING',
    },
    update: {
      status: 'PENDING',
      convertedCustomerId: null,
      internalNote: null,
    },
  });

  return {
    customerId: customer.id,
    routeId: route.id,
    orderId: order.id,
  };
}

async function cleanupAuditFixtures() {
  await prisma.companyRegistrationRequest.deleteMany({ where: { id: 'ux-audit-registration-lead' } });
}

function startChrome() {
  return spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-crash-reporter',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${chromeProfile}`,
    'about:blank',
  ], { stdio: 'ignore' });
}

async function waitForProcessClose(process) {
  if (process.exitCode !== null || process.killed) {
    await sleep(500);
    return;
  }

  await Promise.race([
    new Promise((resolve) => process.once('close', resolve)),
    sleep(2500),
  ]);
}

async function safeRm(target) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(target, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) {
        console.warn(`Could not remove temporary Chrome profile: ${error.message}`);
        return;
      }
      await sleep(500);
    }
  }
}

async function connectToChrome() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${chromePort}/json/new?about:blank`, { method: 'PUT' });
      const target = await response.json();
      const ws = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', reject, { once: true });
      });
      return new CdpPage(ws);
    } catch {
      await sleep(250);
    }
  }

  throw new Error('Chrome did not start with remote debugging.');
}

async function setViewport(page, viewport) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.scale,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
}

async function navigate(page, routePath) {
  await page.send('Page.navigate', { url: `${baseUrl}${routePath}` });
  await sleep(1600);
  await evaluate(page, () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  });
}

async function captureRoute(page, viewport, slug, routePath) {
  await navigate(page, routePath);
  await capture(page, viewport, slug, routePath, 'page');
}

async function capture(page, viewport, slug, routePath, state) {
  await sleep(350);
  const file = path.join(screenshotRoot, viewport.name, `${slug}.png`);
  const isModalState = state.includes('modal');
  const result = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !isModalState, fromSurface: true });
  await writeFile(file, Buffer.from(result.data, 'base64'));
  manifest.push({
    slug,
    route: routePath,
    state,
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    screenshot: path.relative(auditRoot, file).replaceAll('\\', '/'),
  });
}

async function loginAdmin(page) {
  await navigate(page, '/admin/login');
  await evaluate(page, () => {
    const inputs = Array.from(document.querySelectorAll('input'));
    setReactInputValue(inputs[0], 'admin@livneys.local');
    setReactInputValue(inputs[1], 'livneys-admin');
    document.querySelector('form')?.requestSubmit();
  });
  await sleep(1600);
}

async function loginCustomer(page) {
  await navigate(page, '/login');
  await evaluate(page, () => {
    const password = document.querySelector('input[name="password"]');
    setReactInputValue(password, 'livneys-demo');
    document.querySelector('form')?.requestSubmit();
  });
  await sleep(1600);
}

async function selectFirstManualOrderCustomer(page) {
  await evaluate(page, () => {
    const select = document.querySelector('select');
    if (!select || select.options.length === 0) return;
    select.value = select.options[0].value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(900);
}

async function openNotificationSettings(page) {
  await clickText(page, 'הגדרות חיבור ותבניות');
}

async function closeDialog(page) {
  await evaluate(page, () => {
    const dialog = document.querySelector('[role="dialog"]');
    const closeButton = dialog?.querySelector('button[aria-label]');
    closeButton?.click();
  });
  await sleep(500);
}

async function clickText(page, text) {
  const clicked = await evaluate(page, (needle) => {
    const candidates = Array.from(document.querySelectorAll('button, a, summary'));
    const match = candidates.find((element) => element.textContent?.includes(needle));
    if (!match) return false;
    match.click();
    return true;
  }, text);
  await sleep(800);
  return clicked;
}

async function evaluate(page, fn, arg) {
  const source = `(${fn.toString()})(${JSON.stringify(arg)})`;
  const result = await page.send('Runtime.evaluate', {
    expression: `
      window.setReactInputValue = window.setReactInputValue || function(input, value) {
        if (!input) return;
        const setter = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value')?.set;
        setter ? setter.call(input, value) : input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      ${source}
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.result?.value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
