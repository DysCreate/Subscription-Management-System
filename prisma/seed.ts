/**
 * Seeds the demo dataset required by Phase 1 of task.md:
 *   1 admin, 2 staff, sample customers, plus a small Brightloop catalog
 *   (product with an Odoo "+560" variant, monthly/yearly plans, a tax and a
 *   discount) so the API is demoable straight after `npm run db:seed`.
 *
 * Run: npm run db:seed
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'Admin@12345';
const STAFF_PASSWORD = 'Staff@12345';
const CUSTOMER_PASSWORD = 'Customer@12345';

async function upsertUser(params: {
  email: string;
  password: string;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  customerId?: string | null;
}) {
  const passwordHash = await bcrypt.hash(params.password, 10);
  return prisma.user.upsert({
    where: { email: params.email },
    update: { role: params.role, isActive: true },
    create: {
      email: params.email,
      passwordHash,
      role: params.role,
      customerId: params.customerId ?? null,
    },
  });
}

async function main() {
  const admin = await upsertUser({ email: 'admin@subloop.local', password: PASSWORD, role: 'ADMIN' });
  const staff = await upsertUser({
    email: 'staff@subloop.local',
    password: STAFF_PASSWORD,
    role: 'STAFF',
  });
  await upsertUser({ email: 'ops@subloop.local', password: STAFF_PASSWORD, role: 'STAFF' });

  // ---- Customers -----------------------------------------------------
  const customerSeeds = [
    {
      name: 'Brightloop Retail Pvt Ltd',
      email: 'accounts@brightloop.example',
      phone: '+91 90000 11111',
      billingAddress: '12 Marine Drive, Kochi 682001',
      taxId: '32ABCDE1234F1Z5',
    },
    {
      name: 'Nimbus Traders',
      email: 'finance@nimbus.example',
      phone: '+91 90000 22222',
      billingAddress: '44 MG Road, Bengaluru 560001',
      taxId: '29ABCDE5678F1Z2',
    },
    {
      name: 'Priya Menon',
      email: 'priya@brightloop.example',
      phone: '+91 90000 33333',
      billingAddress: '8 Rose Street, Kochi 682016',
      taxId: null,
    },
  ];

  const customers = [];
  for (const data of customerSeeds) {
    const existing = await prisma.customer.findFirst({ where: { email: data.email } });
    const customer = existing
      ? await prisma.customer.update({ where: { id: existing.id }, data })
      : await prisma.customer.create({ data });
    customers.push(customer);
  }

  // A portal login for the first customer so the customer role is demoable.
  await upsertUser({
    email: 'customer@subloop.local',
    password: CUSTOMER_PASSWORD,
    role: 'CUSTOMER',
    customerId: customers[0].id,
  });

  // ---- Taxes ---------------------------------------------------------
  const gst =
    (await prisma.tax.findFirst({ where: { name: 'GST 18%' } })) ??
    (await prisma.tax.create({ data: { name: 'GST 18%', type: 'PERCENT', rate: new Prisma.Decimal(18) } }));
  await prisma.tax.upsert({
    where: { id: gst.id },
    update: {},
    create: { name: 'GST 18%', type: 'PERCENT', rate: new Prisma.Decimal(18) },
  });
  const handling =
    (await prisma.tax.findFirst({ where: { name: 'Handling fee' } })) ??
    (await prisma.tax.create({
      data: { name: 'Handling fee', type: 'FIXED', rate: new Prisma.Decimal(50) },
    }));

  // ---- Products ------------------------------------------------------
  const odooProduct =
    (await prisma.product.findFirst({ where: { name: 'Odoo Subscription Module' } })) ??
    (await prisma.product.create({
      data: {
        name: 'Odoo Subscription Module',
        type: 'SERVICE',
        salesPrice: new Prisma.Decimal(1200),
        costPrice: new Prisma.Decimal(700),
        notes: 'Core Odoo subscription module licence',
      },
    }));

  const odooBrandVariant =
    (await prisma.productVariant.findFirst({
      where: { productId: odooProduct.id, attribute: 'Brand', value: 'Odoo' },
    })) ??
    (await prisma.productVariant.create({
      data: {
        productId: odooProduct.id,
        attribute: 'Brand',
        value: 'Odoo',
        extraPrice: new Prisma.Decimal(560),
      },
    }));

  const supportProduct =
    (await prisma.product.findFirst({ where: { name: 'Priority Support Retainer' } })) ??
    (await prisma.product.create({
      data: {
        name: 'Priority Support Retainer',
        type: 'SERVICE',
        salesPrice: new Prisma.Decimal(3000),
        costPrice: new Prisma.Decimal(1200),
        notes: '8x5 support with 4 hour response',
      },
    }));

  await prisma.product.findFirst({ where: { name: 'Onboarding Pack' } }).then(
    (existing) =>
      existing ??
      prisma.product.create({
        data: {
          name: 'Onboarding Pack',
          type: 'GOODS',
          salesPrice: new Prisma.Decimal(5000),
          costPrice: new Prisma.Decimal(2500),
          notes: 'One-time implementation',
        },
      }),
  );

  // ---- Plans ---------------------------------------------------------
  const monthlyPlan =
    (await prisma.plan.findFirst({ where: { name: 'Odoo Monthly' } })) ??
    (await prisma.plan.create({
      data: {
        name: 'Odoo Monthly',
        price: new Prisma.Decimal(1450),
        billingPeriod: 'MONTHLY',
        minQuantity: 1,
        autoClose: false,
        closable: true,
        pausable: true,
        renewable: true,
      },
    }));

  await prisma.plan.findFirst({ where: { name: 'Odoo Yearly' } }).then(
    (existing) =>
      existing ??
      prisma.plan.create({
        data: {
          name: 'Odoo Yearly',
          price: new Prisma.Decimal(14500),
          billingPeriod: 'YEARLY',
          minQuantity: 1,
          autoClose: false,
          closable: true,
          pausable: true,
          renewable: true,
        },
      }),
  );

  await prisma.plan.findFirst({ where: { name: 'Daily Pass' } }).then(
    (existing) =>
      existing ??
      prisma.plan.create({
        data: {
          name: 'Daily Pass',
          price: new Prisma.Decimal(200),
          billingPeriod: 'DAILY',
          minQuantity: 1,
          autoClose: true,
          closable: true,
          pausable: false,
          renewable: false,
        },
      }),
  );

  // ---- Discount rule -------------------------------------------------
  await prisma.discount.findFirst({ where: { name: 'Launch offer 10%' } }).then(
    (existing) =>
      existing ??
      prisma.discount.create({
        data: {
          name: 'Launch offer 10%',
          type: 'PERCENT',
          value: new Prisma.Decimal(10),
          minPurchase: new Prisma.Decimal(1000),
          usageLimit: 100,
          scope: 'SUBSCRIPTION',
        },
      }),
  );

  // ---- Quotation template -------------------------------------------
  const template =
    (await prisma.quotationTemplate.findFirst({ where: { name: 'Odoo monthly starter' } })) ??
    (await prisma.quotationTemplate.create({
      data: {
        name: 'Odoo monthly starter',
        planId: monthlyPlan.id,
        validityDays: 14,
        lines: {
          create: [
            { productId: odooProduct.id, variantId: odooBrandVariant.id, quantity: 1 },
            { productId: supportProduct.id, quantity: 1 },
          ],
        },
      },
    }));

  console.log('Seed complete:');
  console.log(`  admin     admin@subloop.local / ${PASSWORD}`);
  console.log(`  staff     staff@subloop.local / ${STAFF_PASSWORD} (id ${staff.id})`);
  console.log(`  customer  customer@subloop.local / ${CUSTOMER_PASSWORD}`);
  console.log(`  admin id  ${admin.id}`);
  console.log(`  catalog   product+variant, 3 plans, taxes, discount, template ${template.id}`);
  console.log(`  taxes     GST ${gst.id}, Handling ${handling.id}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
