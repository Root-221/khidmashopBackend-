import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.oTP.deleteMany();
  await prisma.$executeRaw`DELETE FROM "refresh_tokens"`;
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  console.log('🗑️  Cleared existing data');

  // Create Admin User
  const hashedPassword = await bcrypt.hash('khidma123', 10);

  await prisma.user.create({
    data: {
      name: 'Ousmane Diasssy',
      phone: '+221778627052',
      email: 'ousmane@khidma.shop',
      password: hashedPassword,
      role: 'ADMIN',
      address: 'Rufisque, Tally Bou bess',
    },
  });

  console.log('✅ Admin user created');

  console.log('✨ Seed completed successfully!');
  console.log('');
  console.log('Admin Credentials:');
  console.log('  Email: ousmane@khidma.shop');
  console.log('  Password: khidma123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
