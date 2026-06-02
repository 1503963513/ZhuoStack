import { PrismaClient, Role, Status, MenuType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import Redis from 'ioredis';

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

  // Clean existing data（按依赖顺序删除）
  await prisma.sysDictData.deleteMany({});
  await prisma.sysDict.deleteMany({});
  await prisma.sysMenu.deleteMany({});
  await prisma.sysRole.deleteMany({});
  await prisma.sysPost.deleteMany({});
  await prisma.sysDept.deleteMany({});
  await prisma.user.deleteMany({});

  // ========== 部门管理 ==========
  console.log('Creating departments...');
  const deptRoot = await prisma.sysDept.create({
    data: { name: '总公司', sort: 0, status: Status.ACTIVE },
  });
  const deptTech = await prisma.sysDept.create({
    data: { name: '技术部', parentId: deptRoot.id, sort: 1, status: Status.ACTIVE },
  });
  const deptProduct = await prisma.sysDept.create({
    data: { name: '产品部', parentId: deptRoot.id, sort: 2, status: Status.ACTIVE },
  });
  const deptOps = await prisma.sysDept.create({
    data: { name: '运维部', parentId: deptRoot.id, sort: 3, status: Status.ACTIVE },
  });
  const deptFrontend = await prisma.sysDept.create({
    data: { name: '前端组', parentId: deptTech.id, sort: 1, status: Status.ACTIVE },
  });
  const deptBackend = await prisma.sysDept.create({
    data: { name: '后端组', parentId: deptTech.id, sort: 2, status: Status.ACTIVE },
  });
  console.log('Departments created');

  // ========== 岗位管理 ==========
  console.log('Creating posts...');
  const postDev = await prisma.sysPost.create({
    data: { name: '开发工程师', code: 'dev', sort: 1, status: Status.ACTIVE },
  });
  const postPm = await prisma.sysPost.create({
    data: { name: '产品经理', code: 'pm', sort: 2, status: Status.ACTIVE },
  });
  const postOps = await prisma.sysPost.create({
    data: { name: '运维工程师', code: 'ops', sort: 3, status: Status.ACTIVE },
  });
  console.log('Posts created');

  // ========== 菜单管理（内置系统菜单） ==========
  console.log('Creating menus...');

  // 一级菜单：系统管理
  const menuSystem = await prisma.sysMenu.create({
    data: {
      name: '系统管理',
      type: MenuType.DIRECTORY,
      path: '/system',
      icon: 'Settings',
      sort: 1,
      status: Status.ACTIVE,
    },
  });

  // 二级菜单：系统管理子菜单
  const menuDept = await prisma.sysMenu.create({
    data: {
      name: '部门管理',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/dept',
      component: 'system/dept/index',
      icon: 'Building2',
      sort: 1,
      status: Status.ACTIVE,
    },
  });

  const menuPost = await prisma.sysMenu.create({
    data: {
      name: '岗位管理',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/post',
      component: 'system/post/index',
      icon: 'Briefcase',
      sort: 2,
      status: Status.ACTIVE,
    },
  });

  const menuRole = await prisma.sysMenu.create({
    data: {
      name: '角色管理',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/role',
      component: 'system/role/index',
      icon: 'Shield',
      sort: 3,
      status: Status.ACTIVE,
    },
  });

  const menuMenu = await prisma.sysMenu.create({
    data: {
      name: '菜单管理',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/menu',
      component: 'system/menu/index',
      icon: 'Menu',
      sort: 4,
      status: Status.ACTIVE,
    },
  });

  const menuDict = await prisma.sysMenu.create({
    data: {
      name: '字典管理',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/dict',
      component: 'system/dict/index',
      icon: 'BookOpen',
      sort: 5,
      status: Status.ACTIVE,
    },
  });

  const menuUser = await prisma.sysMenu.create({
    data: {
      name: '用户管理',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/user',
      component: 'system/user/index',
      icon: 'Users',
      sort: 6,
      status: Status.ACTIVE,
    },
  });

  await prisma.sysMenu.create({
    data: {
      name: '操作日志',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/oper-log',
      component: 'system/oper-log/index',
      icon: 'FileText',
      sort: 7,
      status: Status.ACTIVE,
    },
  });

  await prisma.sysMenu.create({
    data: {
      name: '登录日志',
      parentId: menuSystem.id,
      type: MenuType.MENU,
      path: '/system/login-log',
      component: 'system/login-log/index',
      icon: 'FileText',
      sort: 8,
      status: Status.ACTIVE,
    },
  });

  // 三级菜单：按钮权限（部门管理下的操作按钮）
  await prisma.sysMenu.createMany({
    data: [
      { name: '部门新增', parentId: menuDept.id, type: MenuType.BUTTON, perms: 'system:dept:add', sort: 1, status: Status.ACTIVE },
      { name: '部门编辑', parentId: menuDept.id, type: MenuType.BUTTON, perms: 'system:dept:edit', sort: 2, status: Status.ACTIVE },
      { name: '部门删除', parentId: menuDept.id, type: MenuType.BUTTON, perms: 'system:dept:delete', sort: 3, status: Status.ACTIVE },
    ],
  });

  // 三级菜单：按钮权限（角色管理下的操作按钮）
  await prisma.sysMenu.createMany({
    data: [
      { name: '角色新增', parentId: menuRole.id, type: MenuType.BUTTON, perms: 'system:role:add', sort: 1, status: Status.ACTIVE },
      { name: '角色编辑', parentId: menuRole.id, type: MenuType.BUTTON, perms: 'system:role:edit', sort: 2, status: Status.ACTIVE },
      { name: '角色删除', parentId: menuRole.id, type: MenuType.BUTTON, perms: 'system:role:delete', sort: 3, status: Status.ACTIVE },
    ],
  });

  // 一级菜单：仪表盘
  await prisma.sysMenu.create({
    data: {
      name: '仪表盘',
      type: MenuType.MENU,
      path: '/dashboard',
      component: 'dashboard/index',
      icon: 'LayoutDashboard',
      sort: 0,
      status: Status.ACTIVE,
    },
  });

  // 一级目录：系统监控
  const menuMonitor = await prisma.sysMenu.create({
    data: {
      name: '系统监控',
      type: MenuType.DIRECTORY,
      path: '/monitor',
      icon: 'Monitor',
      sort: 2,
      status: Status.ACTIVE,
    },
  });

  // 系统监控子菜单
  await prisma.sysMenu.create({
    data: {
      name: '缓存列表',
      parentId: menuMonitor.id,
      type: MenuType.MENU,
      path: '/monitor/cache',
      component: 'monitor/cache/index',
      icon: 'Database',
      sort: 1,
      status: Status.ACTIVE,
    },
  });

  await prisma.sysMenu.create({
    data: {
      name: '在线用户',
      parentId: menuMonitor.id,
      type: MenuType.MENU,
      path: '/monitor/online',
      component: 'monitor/online/index',
      icon: 'Users',
      sort: 2,
      status: Status.ACTIVE,
    },
  });

  await prisma.sysMenu.create({
    data: {
      name: '定时任务',
      parentId: menuMonitor.id,
      type: MenuType.MENU,
      path: '/monitor/jobs',
      component: 'monitor/jobs/index',
      icon: 'Timer',
      sort: 3,
      status: Status.ACTIVE,
    },
  });

  await prisma.sysMenu.create({
    data: {
      name: '接口文档',
      parentId: menuMonitor.id,
      type: MenuType.MENU,
      path: '/monitor/swagger',
      component: 'monitor/swagger/index',
      icon: 'FileText',
      sort: 4,
      status: Status.ACTIVE,
    },
  });

  await prisma.sysMenu.create({
    data: {
      name: '服务器信息',
      parentId: menuMonitor.id,
      type: MenuType.MENU,
      path: '/monitor/server',
      component: 'monitor/server/index',
      icon: 'Server',
      sort: 5,
      status: Status.ACTIVE,
    },
  });

  // 一级菜单：个人中心（默认隐藏）
  await prisma.sysMenu.create({
    data: {
      name: '个人中心',
      type: MenuType.MENU,
      path: '/profile',
      component: 'profile/index',
      icon: 'User',
      sort: 2,
      status: Status.ACTIVE,
      hidden: true,
    },
  });

  console.log('Menus created');

  // ========== 角色管理 ==========
  console.log('Creating roles...');
  const roleAdmin = await prisma.sysRole.create({
    data: {
      name: '超级管理员',
      code: 'admin',
      sort: 1,
      status: Status.ACTIVE,
      remark: '拥有所有权限',
      menus: {
        connect: [
          { id: menuSystem.id },
          { id: menuDept.id },
          { id: menuPost.id },
          { id: menuRole.id },
          { id: menuMenu.id },
          { id: menuDict.id },
        ],
      },
    },
  });

  const roleUser = await prisma.sysRole.create({
    data: {
      name: '普通用户',
      code: 'user',
      sort: 2,
      status: Status.ACTIVE,
      remark: '基础权限',
    },
  });
  console.log('Roles created');

  // ========== 字典管理 ==========
  console.log('Creating dictionaries...');
  const dictGender = await prisma.sysDict.create({
    data: {
      name: '用户性别',
      code: 'sys_user_gender',
      status: Status.ACTIVE,
    },
  });
  await prisma.sysDictData.createMany({
    data: [
      { dictId: dictGender.id, label: '男', value: 'male', sort: 1, status: Status.ACTIVE },
      { dictId: dictGender.id, label: '女', value: 'female', sort: 2, status: Status.ACTIVE },
      { dictId: dictGender.id, label: '未知', value: 'unknown', sort: 3, status: Status.ACTIVE },
    ],
  });

  const dictStatus = await prisma.sysDict.create({
    data: {
      name: '系统状态',
      code: 'sys_status',
      status: Status.ACTIVE,
    },
  });
  await prisma.sysDictData.createMany({
    data: [
      { dictId: dictStatus.id, label: '启用', value: 'ACTIVE', sort: 1, status: Status.ACTIVE },
      { dictId: dictStatus.id, label: '停用', value: 'INACTIVE', sort: 2, status: Status.ACTIVE },
    ],
  });

  const dictYesNo = await prisma.sysDict.create({
    data: {
      name: '是否',
      code: 'sys_yes_no',
      status: Status.ACTIVE,
    },
  });
  await prisma.sysDictData.createMany({
    data: [
      { dictId: dictYesNo.id, label: '是', value: '1', sort: 1, status: Status.ACTIVE },
      { dictId: dictYesNo.id, label: '否', value: '0', sort: 2, status: Status.ACTIVE },
    ],
  });
  console.log('Dictionaries created');

  // ========== 用户管理 ==========
  console.log('Creating users...');

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: await bcrypt.hash(sha256Hash('admin123'), 10),
      role: Role.ADMIN,
      avatar: null,
      deptId: deptTech.id,
      roles: { connect: [{ id: roleAdmin.id }] },
      posts: { connect: [{ id: postDev.id }] },
    },
  });
  console.log(`Created admin user: ${admin.email}`);

  // Create test users
  const testUsers = [
    { email: 'user1@example.com', name: 'Test User 1', deptId: deptFrontend.id, postId: postDev.id },
    { email: 'user2@example.com', name: 'Test User 2', deptId: deptBackend.id, postId: postDev.id },
    { email: 'user3@example.com', name: 'Test User 3', deptId: deptProduct.id, postId: postPm.id },
  ];

  for (const u of testUsers) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        password: await bcrypt.hash(sha256Hash('password123'), 10),
        role: Role.USER,
        avatar: null,
        deptId: u.deptId,
        roles: { connect: [{ id: roleUser.id }] },
        posts: { connect: [{ id: u.postId }] },
      },
    });
    console.log(`Created user: ${user.email}`);
  }

  console.log('Seeding completed!');

  // 清除 Redis 缓存
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 2000, lazyConnect: true });
  try {
    await redis.connect();
    await redis.flushdb();
    console.log('Redis cache cleared');
  } catch {
    console.log('Redis not available, skipping cache clear');
  } finally {
    redis.disconnect();
  }
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
