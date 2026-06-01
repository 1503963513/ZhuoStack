import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.user.deleteMany({});

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: await bcrypt.hash('admin123', 10),
      role: Role.ADMIN,
      avatar: null,
    },
  });
  console.log(`Created admin user: ${admin.email}`);

  // Create test users
  const testUsers = [
    { email: 'user1@example.com', name: 'Test User 1' },
    { email: 'user2@example.com', name: 'Test User 2' },
    { email: 'user3@example.com', name: 'Test User 3' },
  ];

  for (const u of testUsers) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        password: await bcrypt.hash('password123', 10),
        role: Role.USER,
        avatar: null,
      },
    });
    console.log(`Created user: ${user.email}`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
