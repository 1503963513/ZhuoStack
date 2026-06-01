import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

/**
 * 对密码进行 SHA-256 哈希（模拟前端处理）
 * 后端存储时再用 bcrypt 进行二次哈希
 */
function sha256Hash(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.user.deleteMany({});

  // Create admin user
  // 密码处理流程：原始密码 → SHA-256 哈希 → bcrypt 哈希
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: await bcrypt.hash(sha256Hash('admin123'), 10),
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
        password: await bcrypt.hash(sha256Hash('password123'), 10),
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
