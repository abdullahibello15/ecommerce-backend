import { PrismaClient, TransactionStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const gateways = ['paystack', 'flutterwave', 'stripe'];
const statuses = [TransactionStatus.SUCCESS, TransactionStatus.FAILED, TransactionStatus.PENDING, TransactionStatus.REVERSED];
const names = ['Chukwuemeka Obi', 'Amaka Eze', 'Tunde Adeyemi', 'Ngozi Okafor', 'Bola Adesanya', 'Chiamaka Nwosu'];
const emails = ['c.obi@email.com', 'amaka@email.com', 'tunde@email.com', 'ngozi@email.com', 'bola@email.com', 'chiamaka@email.com'];

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysBack: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - randomBetween(0, daysBack));
  d.setHours(randomBetween(0, 23), randomBetween(0, 59));
  return d;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Default admin user
  const hashedPassword = await bcrypt.hash('Password123!', 12);
  const user = await prisma.user.upsert({
    where: { email: 'admin@payplatform.com' },
    update: {},
    create: {
      email: 'admin@payplatform.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.OWNER,
      emailVerified: true,
    },
  });
  console.log('✅ Admin user created:', user.email);

  // Gateways
  await prisma.gateway.upsert({
    where: { name: 'paystack' },
    update: {},
    create: { name: 'paystack', displayName: 'Paystack', isActive: true },
  });
  await prisma.gateway.upsert({
    where: { name: 'flutterwave' },
    update: {},
    create: { name: 'flutterwave', displayName: 'Flutterwave', isActive: true },
  });
  await prisma.gateway.upsert({
    where: { name: 'stripe' },
    update: {},
    create: { name: 'stripe', displayName: 'Stripe', isActive: false },
  });
  console.log('✅ Gateways seeded');

  // Transactions (90 days of data)
  const txCount = 200;
  for (let i = 0; i < txCount; i++) {
    const idx = randomBetween(0, names.length - 1);
    const status = statuses[randomBetween(0, statuses.length - 1)];
    const createdAt = randomDate(90);
    await prisma.transaction.create({
      data: {
        reference: `TXN-${uuidv4().substring(0, 8).toUpperCase()}`,
        amount: randomBetween(500, 500000),
        currency: 'NGN',
        status,
        gateway: gateways[randomBetween(0, gateways.length - 1)],
        customerEmail: emails[idx],
        customerName: names[idx],
        description: 'Payment for services',
        paidAt: status === TransactionStatus.SUCCESS ? createdAt : null,
        createdAt,
        updatedAt: createdAt,
      },
    });
  }
  console.log(`✅ ${txCount} transactions seeded`);

  // Billing plans
  const plans = [
    { name: 'starter', displayName: 'Starter', price: 0, features: { transactions: 100, gateways: 1, team: 1 } },
    { name: 'growth', displayName: 'Growth', price: 29, features: { transactions: 10000, gateways: 3, team: 5 } },
    { name: 'enterprise', displayName: 'Enterprise', price: 99, features: { transactions: -1, gateways: -1, team: -1 } },
  ];
  for (const plan of plans) {
    await prisma.billingPlan.upsert({
      where: { id: plan.name },
      update: {},
      create: { id: plan.name, ...plan },
    });
  }
  console.log('✅ Billing plans seeded');

  // Sample notifications
  await prisma.notification.createMany({
    data: [
      { userId: user.id, title: 'Welcome!', message: 'Your account is set up and ready.', type: 'SUCCESS' },
      { userId: user.id, title: 'New transaction', message: 'A payment of ₦50,000 was received.', type: 'INFO' },
      { userId: user.id, title: 'Gateway alert', message: 'Stripe is currently inactive.', type: 'WARNING' },
    ],
  });
  console.log('✅ Notifications seeded');

  console.log('\n🎉 Seed complete! Login with admin@payplatform.com / Password123!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
